{{- if .Values.seaweedfs.enabled -}}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "eventide.fullname" . }}-seaweedfs-s3
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: seaweedfs
type: Opaque
stringData:
  s3.json: |
    {
      "identities": [
        {
          "name": "helm",
          "credentials": [
            {
              "accessKey": "{{ .Values.config.s3.accessKeyID }}",
              "secretKey": "{{ .Values.config.s3.secretAccessKey }}"
            }
          ],
          "actions": ["Admin", "Read", "Write", "List", "Tagging"]
        }
      ]
    }
{{- end }}
