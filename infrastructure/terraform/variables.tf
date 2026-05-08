variable "env" {
  type        = string
  description = "Environment name (production | staging | dev)"
}

variable "region" {
  type        = string
  default     = "eu-west-3"
}

variable "rds_instance_class" {
  type    = string
  default = "db.r7g.xlarge"
}

variable "redis_node_type" {
  type    = string
  default = "cache.r7g.large"
}

variable "eks_public_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}
