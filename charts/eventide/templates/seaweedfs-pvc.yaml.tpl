{{- if and .Values.seaweedfs.enabled .Values.seaweedfs.persistence.enabled -}}
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "eventide.fullname" . }}-seaweedfs-data
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: seaweedfs
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: {{ .Values.seaweedfs.persistence.size | quote }}
  {{- if .Values.seaweedfs.persistence.storageClassName }}
  storageClassName: {{ .Values.seaweedfs.persistence.storageClassName | quote }}
  {{- end }}
{{- end }}
