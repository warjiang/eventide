{{- if .Values.seaweedfs.enabled -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}-seaweedfs
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: seaweedfs
spec:
  type: {{ .Values.seaweedfs.service.type }}
  selector:
    {{- include "eventide.selectorLabels" . | nindent 4 }}
    app.kubernetes.io/component: seaweedfs
  ports:
    - name: master
      port: {{ .Values.seaweedfs.service.ports.master }}
      targetPort: master
    - name: volume
      port: {{ .Values.seaweedfs.service.ports.volume }}
      targetPort: volume
    - name: public
      port: {{ .Values.seaweedfs.service.ports.public }}
      targetPort: public
    - name: s3
      port: {{ .Values.seaweedfs.service.ports.s3 }}
      targetPort: s3
{{- end }}
