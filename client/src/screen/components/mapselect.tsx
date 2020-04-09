import * as React from 'react';

import $ from "jquery";

import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import uploadFile from '../../util/upload';
import LoadingOverlay from './loadingoverlay';

/**
 * A modal to provide the user a list of maps to choose from.
 */
export default class MapSelect extends React.Component<{ show: boolean, toggleShow: () => void, processMap: (data: any, name?: string) => void }, { maps: string[], selectedMap: string, loading: boolean }> {

    constructor(props) {
        super(props);
        this.state = { maps: [], selectedMap: "", loading: false }
    }

    updateMaps() {
        this.setState({ loading: true })
        var that = this;
        $.ajax({
            url: "/maps",
            type: "get",
            success: function (data) {
                that.setState({ maps: data, loading: false, selectedMap: data[0] })
                that.setState({ loading: false });
            }
        });
    }

    uploadMap() {
        uploadFile((result, name) => {
            if (!name.endsWith(".json")) {
                alert("Can only upload .json files...");
                return;
            }
            this.setState({ loading: true });
            name = name.substr(0, name.length - 5);
            name = name.replace(" ", "_");
            const that = this;
            console.log(result);
            $.ajax({
                type: "POST",
                url: "/maps/" + name,
                data: result,
                contentType: "application/json",
                success: function (response) {
                    if (!(name in that.state.maps))
                        that.state.maps.push(name);
                    that.setState({ selectedMap: name, loading: false });
                },
                error: function (err) {
                    console.log(err);
                    that.setState({ loading: false });
                    alert("Error uploading file: " + err.statusText);
                }
            })
        })
    }


    setMap() {
        this.setState({ loading: true })
        var that = this;
        var name = this.state.selectedMap;
        $.get("/maps/" + this.state.selectedMap, function (data) {
            that.props.processMap(data, name);
            that.props.toggleShow();
            that.setState({ loading: false });
        });
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.show && this.props.show != prevProps.show) {
            this.updateMaps();
        }
    }

    render() {
        let maps = [];
        for (var map of this.state.maps) {
            maps.push(<option key={map}>{map}</option>);
        }
        return (
            <div>
                <Modal show={this.props.show} onHide={this.props.toggleShow}>
                    <Modal.Header closeButton>
                        <Modal.Title>Select Map</Modal.Title>
                    </Modal.Header>

                    <Modal.Body>
                        <p>Select an existing map or upload a new one.</p>
                        <Row>
                            <Col>
                                <select className="form-control" value={this.state.selectedMap} onChange={e => this.setState({ selectedMap: e.target.value })} >
                                    {maps}
                                </select>
                            </Col>
                            <Col>
                                <Button variant="primary" block onClick={this.uploadMap.bind(this)}>Upload Map</Button>
                            </Col>
                        </Row>
                    </Modal.Body>

                    <Modal.Footer>
                        <Button variant="secondary" onClick={this.props.toggleShow}>Close</Button>
                        <Button variant="primary" onClick={this.setMap.bind(this)}>Select Map</Button>
                    </Modal.Footer>
                </Modal>
                <LoadingOverlay enabled={this.state.loading}></LoadingOverlay>
            </div>
        )
    }
}