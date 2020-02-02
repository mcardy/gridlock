import * as React from "react";

export default class LoadingOverlay extends React.Component<{ enabled: boolean }, {}> {

    render() {
        return (
            <div className="fade modal-backdrop show" style={{ display: this.props.enabled ? "block" : "none", zIndex: 2000 }}>
                <div className="d-flex align-items-center h-100">
                    <div className="spinner-border text-primary d-flex" style={{ width: "5rem", height: "5rem", margin: "0 auto", opacity: 1, zIndex: 3000 }}></div>
                </div>
            </div>
        );
    }

}