{{- if .Values.gateway.enabled -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "eventide.gatewayServiceName" . }}
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: gateway
spec:
  type: {{ .Values.gateway.service.type }}
  selector:
    {{- include "eventide.selectorLabels" . | nindent 4 }}
    app.kubernetes.io/component: gateway
  ports:
    - name: http
      port: {{ .Values.gateway.service.port }}
      targetPort: http
      protocol: TCP
{{- end }}
