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
---
# Bind workloadmanager ClusterRole to the ServiceAccount
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: {{ include "eventide.fullname" . }}-playground-workloadmanager
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
subjects:
  - kind: ServiceAccount
    name: {{ include "eventide.fullname" . }}-playground
    namespace: {{ .Release.Namespace }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: workloadmanager
---
# Grant permission to list customresourcedefinitions
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: {{ include "eventide.fullname" . }}-playground-crd-reader
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
rules:
  - apiGroups: ["apiextensions.k8s.io"]
    resources: ["customresourcedefinitions"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: {{ include "eventide.fullname" . }}-playground-crd-reader
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
subjects:
  - kind: ServiceAccount
    name: {{ include "eventide.fullname" . }}-playground
    namespace: {{ .Release.Namespace }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: {{ include "eventide.fullname" . }}-playground-crd-reader
{{- end }}
{{- end }}
