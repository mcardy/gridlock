import * as React from 'react';

import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';

/**
 * A modal that consists of a string popup
 */
export default class GetStringModal extends React.Component<{ title: string, show: boolean, toggleShow: () => void, callback: (name: string) => void, placeholder?: string, description?: string, doneText?: string, initialValue?: string }, { value: string }> {

    constructor(props) {
        super(props);
        this.state = { value: this.props.initialValue != undefined ? this.props.initialValue : "" };
    }

    set() {
        this.props.callback(this.state.value);
        this.props.toggleShow();
    }

    change(event) {
        this.setState({ value: event.target.value })
    }

    componentDidUpdate(previousProperties) {
        if (previousProperties.initialValue != this.props.initialValue) {
            this.setState({ value: this.props.initialValue });
        }
    }

    render() {
        var description = this.props.description != undefined ? <p>{this.props.description}</p> : undefined;
        return (<Modal show={this.props.show} onHide={this.props.toggleShow}>
            <Modal.Header closeButton>
                <Modal.Title>{this.props.title}</Modal.Title>
            </Modal.Header>

            <Modal.Body>
                {description}
                <input className="form-control" value={this.state.value} onChange={this.change.bind(this)} placeholder={this.props.placeholder}></input>
            </Modal.Body>

            <Modal.Footer>
                <Button variant="secondary" onClick={this.props.toggleShow}>Close</Button>
                <Button variant="primary" onClick={this.set.bind(this)}>{this.props.doneText != undefined ? this.props.doneText : "Done"}</Button>
            </Modal.Footer>
        </Modal>);
    }
}