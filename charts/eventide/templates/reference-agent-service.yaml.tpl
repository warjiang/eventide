{{- if .Values.referenceAgent.enabled -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "eventide.fullname" . }}-reference-agent
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: reference-agent
spec:
  type: {{ .Values.referenceAgent.service.type }}
  selector:
    {{- include "eventide.selectorLabels" . | nindent 4 }}
    app.kubernetes.io/component: reference-agent
  ports:
    - name: http
      port: {{ .Values.referenceAgent.service.port }}
      targetPort: http
      protocol: TCP
{{- end }}
