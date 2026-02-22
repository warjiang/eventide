{{- if .Values.playground.enabled -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "eventide.fullname" . }}-playground
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: playground
spec:
  type: {{ .Values.playground.service.type }}
  ports:
    - port: {{ .Values.playground.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "eventide.selectorLabels" . | nindent 4 }}
    app.kubernetes.io/component: playground
{{- end }}
