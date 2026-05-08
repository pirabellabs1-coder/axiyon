{{/*
Common helpers for the Axion chart.
*/}}

{{- define "axion.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "axion.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "axion.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "axion.labels" -}}
app.kubernetes.io/name: {{ include "axion.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "axion.image" -}}
{{- $tag := default .Values.global.imageTag .repo.image.tag -}}
{{- printf "%s/%s:%s" .Values.global.image.registry .repo.image.repository $tag -}}
{{- end -}}

{{- define "axion.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "axion.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/* Common env from secrets */}}
{{- define "axion.envSecrets" -}}
- name: JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secrets.jwt.secretName }}
      key: {{ .Values.secrets.jwt.secretKey }}
- name: ANTHROPIC_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secrets.llm.secretName }}
      key: {{ .Values.secrets.llm.secretKeyAnthropic }}
      optional: true
- name: OPENAI_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secrets.llm.secretName }}
      key: {{ .Values.secrets.llm.secretKeyOpenai }}
      optional: true
- name: MISTRAL_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secrets.llm.secretName }}
      key: {{ .Values.secrets.llm.secretKeyMistral }}
      optional: true
- name: STRIPE_SECRET_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secrets.stripe.secretName }}
      key: {{ .Values.secrets.stripe.secretKeySecret }}
      optional: true
- name: STRIPE_WEBHOOK_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secrets.stripe.secretName }}
      key: {{ .Values.secrets.stripe.secretKeyWebhook }}
      optional: true
- name: AXION_ENCRYPTION_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secrets.encryption.secretName }}
      key: encryption-key
- name: DB_USER
  valueFrom:
    secretKeyRef:
      name: {{ .Values.postgres.external.secretName }}
      key: {{ .Values.postgres.external.secretKeyUser }}
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ .Values.postgres.external.secretName }}
      key: {{ .Values.postgres.external.secretKeyPassword }}
- name: DATABASE_URL
  value: "postgresql+asyncpg://$(DB_USER):$(DB_PASSWORD)@{{ .Values.postgres.external.host }}:{{ .Values.postgres.external.port }}/{{ .Values.postgres.external.database }}"
- name: REDIS_URL
  value: {{ .Values.redis.external.url | quote }}
- name: CELERY_BROKER_URL
  value: {{ printf "%s/1" .Values.redis.external.url | quote }}
- name: CELERY_RESULT_BACKEND
  value: {{ printf "%s/2" .Values.redis.external.url | quote }}
- name: ENV
  value: {{ .Values.global.env | quote }}
- name: REGION
  value: {{ .Values.global.region | quote }}
{{- end -}}
