{{- define "eventide.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "eventide.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := include "eventide.name" . -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "eventide.labels" -}}
app.kubernetes.io/name: {{ include "eventide.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end -}}

{{- define "eventide.selectorLabels" -}}
app.kubernetes.io/name: {{ include "eventide.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "eventide.redisAddr" -}}
{{- if .Values.config.redis.addr -}}
{{- .Values.config.redis.addr -}}
{{- else if .Values.redis.enabled -}}
{{- printf "%s-redis-master:6379" .Release.Name -}}
{{- else -}}
{{- "127.0.0.1:6379" -}}
{{- end -}}
{{- end -}}

{{- define "eventide.pgConnString" -}}
{{- if .Values.config.postgres.connString -}}
{{- .Values.config.postgres.connString -}}
{{- else if .Values.postgresql.enabled -}}
{{- $u := .Values.postgresql.auth.username | default "eventide" -}}
{{- $p := .Values.postgresql.auth.password | default "eventide" -}}
{{- $db := .Values.postgresql.auth.database | default "eventide" -}}
{{- printf "postgres://%s:%s@%s-postgresql:5432/%s?sslmode=disable" $u $p .Release.Name $db -}}
{{- else -}}
{{- "postgres://eventide:eventide@127.0.0.1:5433/eventide?sslmode=disable" -}}
{{- end -}}
{{- end -}}

{{- define "eventide.s3Endpoint" -}}
{{- if .Values.config.s3.endpoint -}}
{{- .Values.config.s3.endpoint -}}
{{- else if .Values.seaweedfs.enabled -}}
{{- printf "http://%s-seaweedfs:%d" .Release.Name (int .Values.seaweedfs.service.ports.s3) -}}
{{- else -}}
{{- "" -}}
{{- end -}}
{{- end -}}

{{- define "eventide.secretsName" -}}
{{- printf "%s-secrets" (include "eventide.fullname" .) -}}
{{- end -}}

{{- define "eventide.gatewayServiceName" -}}
{{- printf "%s-gateway" (include "eventide.fullname" .) -}}
{{- end -}}
