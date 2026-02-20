{{- if .Values.beacon.enabled -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "eventide.fullname" . }}-beacon
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: beacon
spec:
  replicas: {{ .Values.beacon.replicaCount }}
  selector:
    matchLabels:
      {{- include "eventide.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: beacon
  template:
    metadata:
      labels:
        {{- include "eventide.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: beacon
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: beacon
          image: {{ printf "%s:%s" .Values.beacon.image.repository .Values.beacon.image.tag | quote }}
          imagePullPolicy: {{ .Values.beacon.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.beacon.service.port }}
              protocol: TCP
          env:
            - name: HTTP_ADDR
              value: {{ printf "0.0.0.0:%d" (int .Values.beacon.service.port) | quote }}
            - name: REDIS_ADDR
              value: {{ include "eventide.redisAddr" . | quote }}
            - name: REDIS_USERNAME
              value: {{ .Values.config.redis.username | quote }}
            - name: REDIS_DB
              value: {{ .Values.config.redis.db | quote }}
            - name: PG_CONN
              valueFrom:
                secretKeyRef:
                  name: {{ include "eventide.secretsName" . }}
                  key: PG_CONN
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ include "eventide.secretsName" . }}
                  key: REDIS_PASSWORD
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
            {{- toYaml .Values.beacon.resources | nindent 12 }}
{{- end }}
