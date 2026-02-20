package v1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type AgentThreadSpec struct {
	ThreadID           string `json:"threadID"`
	Image              string `json:"image"`
	IdleTimeoutSeconds *int32 `json:"idleTimeoutSeconds,omitempty"`
	Port               *int32 `json:"port,omitempty"`
}

type AgentThreadStatus struct {
	LastActiveAt *metav1.Time `json:"lastActiveAt,omitempty"`
	Phase        string       `json:"phase,omitempty"`
	ServiceName  string       `json:"serviceName,omitempty"`
}

type AgentThread struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   AgentThreadSpec   `json:"spec,omitempty"`
	Status AgentThreadStatus `json:"status,omitempty"`
}

type AgentThreadList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []AgentThread `json:"items"`
}
