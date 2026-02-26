{{- if .Values.playground.enabled -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "eventide.fullname" . }}-playground
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: playground
spec:
  replicas: {{ .Values.playground.replicaCount }}
  selector:
    matchLabels:
      {{- include "eventide.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: playground
  template:
    metadata:
      labels:
        {{- include "eventide.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: playground
    spec:
      serviceAccountName: {{ include "eventide.fullname" . }}-playground
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: playground
          image: {{ printf "%s:%s" .Values.playground.image.repository .Values.playground.image.tag | quote }}
          imagePullPolicy: {{ .Values.playground.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.playground.service.port }}
              protocol: TCP
          env:
            - name: HOST
              value: "0.0.0.0"
            - name: PORT
              value: {{ .Values.playground.service.port | quote }}
            - name: BEACON_URL
              value: {{ printf "http://%s-beacon:%d" (include "eventide.fullname" .) (int .Values.beacon.service.port) | quote }}
            - name: AGENTCUBE_ROUTER_URL
              value: http://agentcube-router.agentcube.svc:8080
            - name: PG_CONN
              valueFrom:
                secretKeyRef:
                  name: {{ include "eventide.secretsName" . }}
                  key: PG_CONN
            - name: SEAWEEDFS_MASTER_URL
              value: {{ printf "http://%s-seaweedfs.%s.svc.cluster.local:%d" .Release.Name .Release.Namespace (int .Values.seaweedfs.service.ports.master) | quote }}
            - name: SEAWEEDFS_VOLUME_URL
              value: {{ printf "http://%s-seaweedfs.%s.svc.cluster.local:%d" .Release.Name .Release.Namespace (int .Values.seaweedfs.service.ports.volume) | quote }}
            - name: SEAWEEDFS_PUBLIC_URL
              value: {{ printf "http://%s-seaweedfs.%s.svc.cluster.local:%d" .Release.Name .Release.Namespace (int .Values.seaweedfs.service.ports.public) | quote }}
            - name: SEAWEEDFS_BUCKET
              value: "uploads"
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
            {{- toYaml .Values.playground.resources | nindent 12 }}
{{- end }}
