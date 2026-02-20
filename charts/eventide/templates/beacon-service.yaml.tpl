{{- if .Values.beacon.enabled -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "eventide.fullname" . }}-beacon
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: beacon
spec:
  type: {{ .Values.beacon.service.type }}
  selector:
    {{- include "eventide.selectorLabels" . | nindent 4 }}
    app.kubernetes.io/component: beacon
  ports:
    - name: http
      port: {{ .Values.beacon.service.port }}
      targetPort: http
      protocol: TCP
{{- end }}
