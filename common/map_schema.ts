const map_schema = {
    "definitions": {},
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "http://example.com/root.json",
    "type": "object",
    "title": "Map Schema",
    "required": [
        "width",
        "height",
        "vertices",
        "edges",
    ],
    "properties": {
        "spawn_rate": {
            "$id": "#/properties/spawn_rate",
            "type": "integer",
            "title": "Spawn Rate",
            "default": 5
        },
        "seed": {
            "$id": "#/properties/seed",
            "type": "integer",
            "title": "Map Seed",
            "default": 123456789,
            "examples": [
                123456789
            ]
        },
        "width": {
            "$id": "#/properties/width",
            "type": "integer",
            "title": "Map Width",
            "default": 800,
            "examples": [
                800
            ]
        },
        "height": {
            "$id": "#/properties/height",
            "type": "integer",
            "title": "Map Height",
            "default": 600,
            "examples": [
                600
            ]
        },
        "vertices": {
            "$id": "#/properties/vertices",
            "type": "array",
            "title": "Vertices",
            "items": {
                "$id": "#/properties/vertices/items",
                "type": "object",
                "title": "Vertex",
                "required": [
                    "id",
                    "location",
                ],
                "properties": {
                    "id": {
                        "$id": "#/properties/vertices/items/properties/id",
                        "type": "integer",
                        "title": "Vertex ID (UNIQUE)",
                        "default": 0,
                        "examples": [
                            1
                        ]
                    },
                    "location": {
                        "$id": "#/properties/vertices/items/properties/location",
                        "type": "object",
                        "title": "Vertex Location",
                        "required": [
                            "x",
                            "y"
                        ],
                        "properties": {
                            "x": {
                                "$id": "#/properties/vertices/items/properties/location/properties/x",
                                "type": "integer",
                                "title": "X Coord",
                                "default": 0,
                                "examples": [
                                    100
                                ]
                            },
                            "y": {
                                "$id": "#/properties/vertices/items/properties/location/properties/y",
                                "type": "integer",
                                "title": "Y Coord",
                                "default": 0,
                                "examples": [
                                    200
                                ]
                            }
                        }
                    },
                    "source": {
                        "$id": "#/properties/vertices/items/properties/source",
                        "type": "boolean",
                        "title": "Is the Vertex a Source?",
                        "default": false,
                        "examples": [
                            true
                        ]
                    },
                    "dest": {
                        "$id": "#/properties/vertices/items/properties/dest",
                        "type": "boolean",
                        "title": "Is the Vertex a Destination?",
                        "default": false,
                        "examples": [
                            true
                        ]
                    }
                }
            }
        },
        "edges": {
            "$id": "#/properties/edges",
            "type": "array",
            "title": "Edges",
            "items": {
                "$id": "#/properties/edges/items",
                "type": "object",
                "title": "Edge",
                "required": [
                    "source",
                    "dest"
                ],
                "properties": {
                    "source": {
                        "$id": "#/properties/edges/items/properties/source",
                        "type": "integer",
                        "title": "The ID of the source node",
                        "default": 0,
                        "examples": [
                            1
                        ]
                    },
                    "dest": {
                        "$id": "#/properties/edges/items/properties/dest",
                        "type": "integer",
                        "title": "The ID of the destination node",
                        "default": 0,
                        "examples": [
                            9
                        ]
                    },
                    "speed": {
                        "$id": "#/properties/edges/items/properties/speed",
                        "type": "integer",
                        "title": "The speed limit of the edge in kph",
                        "default": 60,
                        "examples": [
                            80
                        ]
                    },
                    "invert": {
                        "$id": "#/properties/edges/items/properties/invert",
                        "type": "boolean",
                        "title": "Invert this edge's path (only applicable to bezier paths)",
                        "default": false,
                        "examples": [
                            true
                        ]
                    },
                    "ctrlX": {
                        "$id": "#/properties/edges/items/properties/ctrlX",
                        "type": "integer",
                        "title": "Overwrite of default origin for bezier path"
                    },
                    "ctrlY": {
                        "$id": "#/properties/edges/items/properties/ctrlY",
                        "type": "integer",
                        "title": "Overwrite of default origin for bezier path"
                    },
                    "priorities": {
                        "$id": "#/properties/edge/item/properties/priorities",
                        "type": "array",
                        "title": "The priorities of this edge if part of an intersection",
                        "items": {
                            "$id": "#/properties/edge/items/properties/priorities/items",
                            "type": "number",
                            "title": "Individual priorities, should have one priority for each phase of intersection this edge is apart of",
                            "default": 0,
                            "examples": [
                                0, 0, 1, 0
                            ]
                        }
                    }
                }
            }
        },
        "intersections": {
            "$id": "#/properties/intersections",
            "type": "array",
            "title": "Intersections",
            "items": {
                "$id": "#/properties/intersections/items",
                "type": "object",
                "title": "Intersection",
                "required": [
                    "vertexIds",
                    "timings"
                ],
                "properties": {
                    "vertexIds": {
                        "$id": "#/properties/intersections/items/properties/vertexIds",
                        "type": "array",
                        "title": "The IDs of vertices that are part of this intersection, edges between these vertices will be part of the intersection",
                        "items": {
                            "$id": "#/properties/intersections/items/properties/vertexIds/items",
                            "type": "number",
                            "title": "The Items Schema",
                            "default": 0,
                            "examples": [
                                9,
                                10,
                                11,
                                12,
                                13,
                                14,
                                15,
                                16
                            ]
                        }
                    },
                    "timings": {
                        "$id": "#/properties/intersections/items/properties/timings",
                        "type": "array",
                        "title": "The Timing of each phase of this intersection in seconds",
                        "items": {
                            "$id": "#/properties/intersections/items/properties/timings/items",
                            "type": "integer",
                            "title": "Seconds for each phase, length of array represents number of phases",
                            "default": 0,
                            "examples": [
                                5,
                                1,
                                5,
                                1
                            ]
                        }
                    }
                }
            }
        }
    }
}

export { map_schema as map_schema }