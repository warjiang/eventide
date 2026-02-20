{{- if .Values.migrate.enabled -}}
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "eventide.fullname" . }}-migrate
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: migrate
  annotations:
    "helm.sh/hook": post-install,post-upgrade
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  backoffLimit: 10
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
      {{- $pgRegistry := "docker.io" -}}
      {{- $pgRepository := "bitnami/postgresql" -}}
      {{- $pgTag := "16.1.0-debian-11-r25" -}}
      {{- if .Values.postgresql -}}
        {{- if .Values.postgresql.image -}}
          {{- $pgRegistry = default $pgRegistry .Values.postgresql.image.registry -}}
          {{- $pgRepository = default $pgRepository .Values.postgresql.image.repository -}}
          {{- $pgTag = default $pgTag .Values.postgresql.image.tag -}}
        {{- end -}}
      {{- end }}
      initContainers:
        - name: wait-for-postgres
          image: {{ printf "%s/%s:%s" $pgRegistry $pgRepository $pgTag | quote }}
          command:
            - sh
            - -c
            - |
              until pg_isready -d "$PG_CONN"; do
                echo "Waiting for PostgreSQL to be ready..."
                sleep 2
              done
          env:
            - name: PG_CONN
              value: {{ include "eventide.pgConnString" . | quote }}
      containers:
        - name: migrate
          image: {{ printf "%s:%s" .Values.migrate.image.repository .Values.migrate.image.tag | quote }}
          imagePullPolicy: {{ .Values.migrate.image.pullPolicy }}
          env:
            - name: PG_CONN
              value: {{ include "eventide.pgConnString" . | quote }}
{{- end }}
