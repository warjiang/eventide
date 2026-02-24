{{- if .Values.playground.enabled -}}
{{- if .Values.playground.serviceAccount.create -}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "eventide.fullname" . }}-playground
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
---
# Bind cluster-admin ClusterRole to the ServiceAccount
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: {{ include "eventide.fullname" . }}-playground-cluster-admin
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
subjects:
  - kind: ServiceAccount
    name: {{ include "eventide.fullname" . }}-playground
    namespace: {{ .Release.Namespace }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
{{- end }}
{{- end }}
