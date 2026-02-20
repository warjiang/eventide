{{- if .Values.migrate.enabled -}}
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "eventide.fullname" . }}-migrate
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: migrate
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  backoffLimit: 3
  template:
    metadata:
      labels:
        {{- include "eventide.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: migrate
    spec:
      restartPolicy: OnFailure
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: migrate
          image: {{ printf "%s:%s" .Values.migrate.image.repository .Values.migrate.image.tag | quote }}
          imagePullPolicy: {{ .Values.migrate.image.pullPolicy }}
          env:
            - name: PG_CONN
              valueFrom:
                secretKeyRef:
                  name: {{ include "eventide.secretsName" . }}
                  key: PG_CONN
{{- end }}
