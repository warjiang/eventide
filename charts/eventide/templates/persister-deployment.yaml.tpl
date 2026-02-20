{{- if .Values.persister.enabled -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "eventide.fullname" . }}-persister
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: persister
spec:
  replicas: {{ .Values.persister.replicaCount }}
  selector:
    matchLabels:
      {{- include "eventide.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: persister
  template:
    metadata:
      labels:
        {{- include "eventide.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: persister
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: persister
          image: {{ printf "%s:%s" .Values.persister.image.repository .Values.persister.image.tag | quote }}
          imagePullPolicy: {{ .Values.persister.image.pullPolicy }}
          env:
            - name: REDIS_ADDR
              value: {{ include "eventide.redisAddr" . | quote }}
            - name: REDIS_USERNAME
              value: {{ .Values.config.redis.username | quote }}
            - name: REDIS_DB
              value: {{ .Values.config.redis.db | quote }}
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ include "eventide.secretsName" . }}
                  key: REDIS_PASSWORD
            - name: PG_CONN
              valueFrom:
                secretKeyRef:
                  name: {{ include "eventide.secretsName" . }}
                  key: PG_CONN
            - name: TENANT_ID
              value: {{ .Values.persister.tenantID | quote }}
            - name: IDLE_TIMEOUT_SECONDS
              value: {{ .Values.persister.idleTimeoutSeconds | quote }}
            - name: PERSISTER_GROUP
              value: {{ .Values.persister.group | quote }}
            {{- if .Values.persister.consumer }}
            - name: PERSISTER_CONSUMER
              value: {{ .Values.persister.consumer | quote }}
            {{- end }}
            - name: PERSISTER_DLQ_STREAM
              value: {{ .Values.persister.dlqStream | quote }}
            - name: PERSISTER_MAX_RETRIES
              value: {{ .Values.persister.maxRetries | quote }}
          resources:
            {{- toYaml .Values.persister.resources | nindent 12 }}
{{- end }}
