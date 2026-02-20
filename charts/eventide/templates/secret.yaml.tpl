{{- if .Values.secrets.create -}}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "eventide.secretsName" . }}
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
type: Opaque
data:
  PG_CONN: {{ include "eventide.pgConnString" . | b64enc | quote }}
  REDIS_PASSWORD: {{ (default .Values.redis.auth.password .Values.config.redis.password) | b64enc | quote }}
  S3_ACCESS_KEY_ID: {{ .Values.config.s3.accessKeyID | b64enc | quote }}
  S3_SECRET_ACCESS_KEY: {{ .Values.config.s3.secretAccessKey | b64enc | quote }}
{{- end }}
