{{- if .Values.gateway.enabled -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "eventide.fullname" . }}-gateway
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: gateway
spec:
  replicas: {{ .Values.gateway.replicaCount }}
  selector:
    matchLabels:
      {{- include "eventide.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: gateway
  template:
    metadata:
      labels:
        {{- include "eventide.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: gateway
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: gateway
          image: {{ printf "%s:%s" .Values.gateway.image.repository .Values.gateway.image.tag | quote }}
          imagePullPolicy: {{ .Values.gateway.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.gateway.service.port }}
              protocol: TCP
          env:
            - name: HTTP_ADDR
              value: {{ printf "0.0.0.0:%d" (int .Values.gateway.service.port) | quote }}
            - name: REDIS_ADDR
              value: {{ include "eventide.redisAddr" . | quote }}
            - name: REDIS_USERNAME
              value: {{ .Values.config.redis.username | quote }}
            - name: REDIS_DB
              value: {{ .Values.config.redis.db | quote }}
            - name: STREAM_TRIM_MAXLEN
              value: {{ .Values.config.streams.trimMaxLen | quote }}
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ include "eventide.secretsName" . }}
                  key: REDIS_PASSWORD
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 3
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 3
            periodSeconds: 10
          resources:
            {{- toYaml .Values.gateway.resources | nindent 12 }}
{{- end }}
