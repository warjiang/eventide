{{- if and .Values.archiver.enabled .Values.archiver.schedule -}}
apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{ include "eventide.fullname" . }}-archiver
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: archiver
spec:
  schedule: {{ .Values.archiver.schedule | quote }}
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 1
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 1
      template:
        metadata:
          labels:
            {{- include "eventide.selectorLabels" . | nindent 12 }}
            app.kubernetes.io/component: archiver
        spec:
          restartPolicy: Never
          {{- with .Values.imagePullSecrets }}
          imagePullSecrets:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          containers:
            - name: archiver
              image: {{ printf "%s:%s" .Values.archiver.image.repository .Values.archiver.image.tag | quote }}
              imagePullPolicy: {{ .Values.archiver.image.pullPolicy }}
              env:
                - name: ARCHIVE_THREAD_ID
                  value: {{ .Values.archiver.threadID | quote }}
                - name: ARCHIVE_FROM_SEQ
                  value: {{ .Values.archiver.fromSeq | quote }}
                - name: ARCHIVE_TO_SEQ
                  value: {{ .Values.archiver.toSeq | quote }}
                - name: PG_CONN
                  valueFrom:
                    secretKeyRef:
                      name: {{ include "eventide.secretsName" . }}
                      key: PG_CONN
                - name: S3_ENDPOINT
                  value: {{ include "eventide.s3Endpoint" . | quote }}
                - name: S3_REGION
                  value: {{ .Values.config.s3.region | quote }}
                - name: S3_BUCKET
                  value: {{ .Values.config.s3.bucket | quote }}
                - name: S3_PREFIX
                  value: {{ .Values.config.s3.prefix | quote }}
                - name: S3_USE_PATH_STYLE
                  value: {{ ternary "1" "0" .Values.config.s3.usePathStyle | quote }}
                - name: S3_ACCESS_KEY_ID
                  valueFrom:
                    secretKeyRef:
                      name: {{ include "eventide.secretsName" . }}
                      key: S3_ACCESS_KEY_ID
                - name: S3_SECRET_ACCESS_KEY
                  valueFrom:
                    secretKeyRef:
                      name: {{ include "eventide.secretsName" . }}
                      key: S3_SECRET_ACCESS_KEY
{{- end }}
