{{- if .Values.seaweedfs.enabled -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-seaweedfs
  labels:
    {{- include "eventide.labels" . | nindent 4 }}
    app.kubernetes.io/component: seaweedfs
spec:
  replicas: 1
  selector:
    matchLabels:
      {{- include "eventide.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: seaweedfs
  template:
    metadata:
      labels:
        {{- include "eventide.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: seaweedfs
    spec:
      containers:
        - name: seaweedfs
          image: {{ printf "%s:%s" .Values.seaweedfs.image.repository .Values.seaweedfs.image.tag | quote }}
          imagePullPolicy: {{ .Values.seaweedfs.image.pullPolicy }}
          args:
            - server
            - -s3
            - -dir=/data
            - -volume.max=0
            - -volume.port={{ .Values.seaweedfs.service.ports.volume }}
            - -volume.publicUrl={{ printf "%s-seaweedfs:%d" .Release.Name (int .Values.seaweedfs.service.ports.volume) }}
            - -s3.config=/etc/seaweedfs/s3.json
            - -ip.bind=0.0.0.0
          ports:
            - name: master
              containerPort: {{ .Values.seaweedfs.service.ports.master }}
            - name: volume
              containerPort: {{ .Values.seaweedfs.service.ports.volume }}
            - name: public
              containerPort: {{ .Values.seaweedfs.service.ports.public }}
            - name: s3
              containerPort: {{ .Values.seaweedfs.service.ports.s3 }}
          volumeMounts:
            - name: data
              mountPath: /data
            - name: s3cfg
              mountPath: /etc/seaweedfs
              readOnly: true
          livenessProbe:
            httpGet:
              path: /cluster/status
              port: master
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /cluster/status
              port: master
            initialDelaySeconds: 10
            periodSeconds: 30
      volumes:
        - name: s3cfg
          secret:
            secretName: {{ include "eventide.fullname" . }}-seaweedfs-s3
        - name: data
          {{- if .Values.seaweedfs.persistence.enabled }}
          persistentVolumeClaim:
            claimName: {{ include "eventide.fullname" . }}-seaweedfs-data
          {{- else }}
          emptyDir: {}
          {{- end }}
{{- end }}
