{{- if .Values.referenceAgent.enabled -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "eventide.fullname" . }}-reference-agent
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: reference-agent
spec:
  replicas: {{ .Values.referenceAgent.replicaCount }}
  selector:
    matchLabels:
      {{- include "eventide.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: reference-agent
  template:
    metadata:
      labels:
        {{- include "eventide.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: reference-agent
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: reference-agent
          image: {{ printf "%s:%s" .Values.referenceAgent.image.repository .Values.referenceAgent.image.tag | quote }}
          imagePullPolicy: {{ .Values.referenceAgent.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.referenceAgent.service.port }}
              protocol: TCP
          env:
            - name: REFERENCE_AGENT_ADDR
              value: {{ printf "0.0.0.0:%d" (int .Values.referenceAgent.service.port) | quote }}
            - name: EVENT_GATEWAY_URL
              value: {{ printf "http://%s:%d" (include "eventide.gatewayServiceName" .) (int .Values.gateway.service.port) | quote }}
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
            {{- toYaml .Values.referenceAgent.resources | nindent 12 }}
{{- end }}
