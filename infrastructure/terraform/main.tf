###############################################################################
#  Axion · Terraform · AWS production stack (eu-west-3)
#
#  Provisions: VPC + EKS + RDS Postgres (pgvector) + ElastiCache Redis +
#              S3 audit bucket + KMS encryption keys + IAM (IRSA) + ACM cert.
###############################################################################

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws        = { source = "hashicorp/aws",        version = "~> 5.70" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.32" }
    helm       = { source = "hashicorp/helm",       version = "~> 2.16" }
    random     = { source = "hashicorp/random",     version = "~> 3.6"  }
  }

  backend "s3" {
    bucket         = "axion-tfstate-prod"
    key            = "axion/eu-west-3/terraform.tfstate"
    region         = "eu-west-3"
    dynamodb_table = "axion-tfstate-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project    = "axion"
      Env        = var.env
      ManagedBy  = "terraform"
      CostCenter = "engineering"
    }
  }
}

###############################################################################
#  VPC
###############################################################################

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.13"

  name                 = "axion-${var.env}"
  cidr                 = "10.42.0.0/16"
  azs                  = ["${var.region}a", "${var.region}b", "${var.region}c"]
  private_subnets      = ["10.42.1.0/24", "10.42.2.0/24", "10.42.3.0/24"]
  public_subnets       = ["10.42.101.0/24", "10.42.102.0/24", "10.42.103.0/24"]
  database_subnets     = ["10.42.201.0/24", "10.42.202.0/24", "10.42.203.0/24"]
  enable_nat_gateway   = true
  single_nat_gateway   = false
  one_nat_gateway_per_az = true
  enable_dns_hostnames = true
  enable_flow_log      = true
  flow_log_destination_type = "cloud-watch-logs"
}

###############################################################################
#  KMS — encryption keys for RDS, S3, secrets
###############################################################################

resource "aws_kms_key" "main" {
  description             = "axion ${var.env} envelope encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "main" {
  name          = "alias/axion-${var.env}"
  target_key_id = aws_kms_key.main.id
}

###############################################################################
#  RDS Postgres 16 with pgvector
###############################################################################

resource "random_password" "db" {
  length  = 32
  special = true
}

module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.10"

  identifier = "axion-${var.env}"
  engine     = "postgres"
  engine_version = "16.4"
  instance_class    = var.rds_instance_class
  allocated_storage = 200
  max_allocated_storage = 2000
  storage_encrypted = true
  kms_key_id        = aws_kms_key.main.arn

  db_name  = "axion"
  username = "axion"
  password = random_password.db.result
  port     = 5432

  multi_az = true
  publicly_accessible = false

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = module.vpc.database_subnet_group_name

  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"
  deletion_protection     = true

  performance_insights_enabled = true
  monitoring_interval          = 30
  enabled_cloudwatch_logs_exports = ["postgresql"]

  family = "postgres16"
  parameter_group_name = "axion-${var.env}-pg16"
  parameters = [
    { name = "shared_preload_libraries", value = "vector,pg_stat_statements" },
    { name = "log_min_duration_statement", value = "500" },
  ]
}

resource "aws_security_group" "db" {
  name   = "axion-${var.env}-db"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = module.vpc.private_subnets_cidr_blocks
  }
}

###############################################################################
#  ElastiCache Redis (Celery broker + cache)
###############################################################################

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "axion-${var.env}"
  description                = "Axion Redis cluster"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 3
  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = aws_kms_key.main.arn
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  snapshot_retention_limit   = 7
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "axion-${var.env}-redis"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "redis" {
  name   = "axion-${var.env}-redis"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = module.vpc.private_subnets_cidr_blocks
  }
}

###############################################################################
#  EKS cluster
###############################################################################

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.24"

  cluster_name    = "axion-${var.env}"
  cluster_version = "1.31"
  cluster_endpoint_public_access = true
  cluster_endpoint_public_access_cidrs = var.eks_public_cidrs

  cluster_addons = {
    coredns                = { most_recent = true }
    kube-proxy             = { most_recent = true }
    vpc-cni                = { most_recent = true }
    aws-ebs-csi-driver     = { most_recent = true }
  }

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  enable_irsa = true

  eks_managed_node_groups = {
    api = {
      desired_size = 4
      min_size     = 4
      max_size     = 20
      instance_types = ["m7i.large"]
      labels = { workload = "api" }
      taints = []
    }
    workers = {
      desired_size = 8
      min_size     = 4
      max_size     = 80
      instance_types = ["m7i.xlarge"]
      labels = { workload = "worker" }
    }
  }
}

###############################################################################
#  S3 audit bucket — append-only, object-lock enabled
###############################################################################

resource "aws_s3_bucket" "audit" {
  bucket = "axion-${var.env}-audit"
  object_lock_enabled = true
}

resource "aws_s3_bucket_versioning" "audit" {
  bucket = aws_s3_bucket.audit.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.main.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_object_lock_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id
  rule {
    default_retention {
      mode = "COMPLIANCE"
      years = 10
    }
  }
}

resource "aws_s3_bucket_public_access_block" "audit" {
  bucket = aws_s3_bucket.audit.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

###############################################################################
#  IRSA — service-account role used by api & worker pods
###############################################################################

module "irsa_axion" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.45"

  role_name = "axion-${var.env}-irsa"
  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["axion:axion"]
    }
  }
  role_policy_arns = {
    s3 = aws_iam_policy.audit_rw.arn
    kms = aws_iam_policy.kms_use.arn
  }
}

resource "aws_iam_policy" "audit_rw" {
  name   = "axion-${var.env}-audit-s3"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
      Resource = [
        aws_s3_bucket.audit.arn,
        "${aws_s3_bucket.audit.arn}/*",
      ]
    }]
  })
}

resource "aws_iam_policy" "kms_use" {
  name = "axion-${var.env}-kms-use"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
      Resource = aws_kms_key.main.arn
    }]
  })
}

###############################################################################
#  Outputs
###############################################################################

output "cluster_endpoint" { value = module.eks.cluster_endpoint }
output "rds_endpoint"     { value = module.rds.db_instance_endpoint }
output "redis_endpoint"   { value = aws_elasticache_replication_group.redis.primary_endpoint_address }
output "audit_bucket"     { value = aws_s3_bucket.audit.bucket }
output "irsa_role_arn"    { value = module.irsa_axion.iam_role_arn }
