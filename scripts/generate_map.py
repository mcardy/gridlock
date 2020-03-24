#!/usr/bin/env python

import json
from argparse import ArgumentParser
from enum import Enum

# Constants
DEFAULT_INTERSECTION_TIMINGS = [5,1,5,1]
BORDER_WIDTH = 50
BORDER_HEIGHT = 50
INTERSECTION_WIDTH = 100
INTERSECTION_HEIGHT = 100
# ---------

# Entities
vertices = []
edges = []
intersections = []
lanes = []

# Supported intersection types
class IntersectionType(Enum):
    ROUNDABOUT = 'roundabout'
    TRAFFIC_LIGHT = 'traffic-light'

    def __str__(self):
        return self.value

# Parse command line options
def parse_options():
    parser = ArgumentParser(description="")
    parser.add_argument("count_x", type=int, help="Number of intersections in x direction")
    parser.add_argument("count_y", type=int, help="Number of intersections in y direction")
    parser.add_argument("intersection_type", type=IntersectionType, choices=list(IntersectionType), help="Type of intersection to generate")
    parser.add_argument("-l", "--lanes", type=bool, help="Whether or not to use multiple lanes", default=False)
    parser.add_argument("-o", "--output", type=str, help="Output file", default="map.json")
    return parser.parse_args()

# Adds an intersection to the data structures defined above
# Returns a list in clockwise order of entrypoints starting from the top left
def generate_intersection(v_start, x_offset, y_offset, intersection_type):
    if (intersection_type == IntersectionType.TRAFFIC_LIGHT and not multi_lane):
        # Intersection takes up 60 units
        intersection_width = 60
        intersection_height = 60
        x_offset += (INTERSECTION_WIDTH - intersection_width)/2
        y_offset += (INTERSECTION_HEIGHT - intersection_height)/2
        # Define the positions of each piece of intersection with respect to new offsets
        x_offsets = [25, 35, 60, 60, 35, 25, 0, 0]
        y_offsets = [0, 0, 25, 35, 60, 60, 35, 25]

        vertexIds = []
        timings = DEFAULT_INTERSECTION_TIMINGS.copy()
        # Add vertices
        for i in range(0,8):
            vertexIds.append(v_start+i)
            vertices.append({"id": v_start+i, "location": {"x": x_offset + x_offsets[i], "y": y_offset + y_offsets[i]}})
        # Consider each direction and add corresponding edges
        for i in range(0,8,2):
            for j in range(1,8,2):
                if (j == i+1): continue
                green_priority = 0.5 if j == i + 3 else 1
                red_priority = 0.25 if i == j + 1 % 8 else 0
                priorities = [red_priority if i % 4 == 0 else green_priority, 0, green_priority if i % 4 == 0 else red_priority, 0]
                edges.append({"source": v_start+i, "dest": v_start+j, "invert": i % 4 == 0, "priorities": priorities})
        intersections.append({"vertexIds": vertexIds, "timings": timings})
        return vertexIds
    elif (intersection_type == IntersectionType.TRAFFIC_LIGHT and multi_lane):
        # Intersection takes up 60 units
        intersection_width = 60
        intersection_height = 60
        x_offset += (INTERSECTION_WIDTH - intersection_width)/2
        y_offset += (INTERSECTION_HEIGHT - intersection_height)/2
        # Define multiple lane portions of intersection with respect to new offsets
        x_offsets = [17, 25, 35, 43, 60, 60, 60, 60, 43, 35, 25, 17, 0, 0, 0, 0]
        y_offsets = [0, 0, 0, 0, 17, 25, 35, 43, 60, 60, 60, 60, 43, 35, 25, 17]

        vertexIds = []
        timings = DEFAULT_INTERSECTION_TIMINGS.copy()
        # Add vertices
        for i in range(0,16):
            vertexIds.append(v_start+i)
            vertices.append({"id": v_start+i, "location": {"x": x_offset + x_offsets[i], "y": y_offset + y_offsets[i]}})
        # Consider each direction and add corresponding edges
        for i in range(0,8,2):
            i1 = 2*i
            i2 = i1+1
            edges.append({"source": v_start+i1, "dest": v_start+(i1+15)%16, "invert": i%4==0, "priorities": [0.25 if i%4==0 else 1, 0, 1 if i%4 == 0 else 0.25, 0]})
            edges.append({"source": v_start+i1, "dest": v_start+(i1+11)%16, "invert": i%4==0, "priorities": [0 if i%4==0 else 1, 0, 1 if i%4 == 0 else 0, 0]})
            edges.append({"source": v_start+i2, "dest": v_start+(i2+9)%16, "invert": i%4==0, "priorities": [0 if i%4==0 else 1, 0, 1 if i%4 == 0 else 0, 0]})
            edges.append({"source": v_start+i2, "dest": v_start+(i2+5)%16, "invert": i%4==0, "priorities": [0 if i%4==0 else 0.5, 0, 0.5 if i%4 == 0 else 0, 0]})
        intersections.append({"vertexIds": vertexIds, "timings": timings})
        return vertexIds
    elif (intersection_type == IntersectionType.ROUNDABOUT and not multi_lane):
        intersection_width = 80
        intersection_height = 80
        x_offset += (INTERSECTION_WIDTH - intersection_width)/2
        y_offset += (INTERSECTION_HEIGHT - intersection_height)/2
        roundabout_speed = 30
        # Define the roundabouts vertex positions, starting with the outer entry/exit points
        x_offsets = [35, 45, 80, 80, 45, 35, 0, 0, 30, 50, 60, 60, 50, 30, 20, 20]
        y_offsets = [0, 0, 35, 45, 80, 80, 45, 35, 20, 20, 30, 50, 60, 60, 50, 30]

        vertexIds = []
        for i in range(0,16):
            if (i < 8): vertexIds.append(v_start+i)
            vertices.append({"id": v_start+i, "location": {"x": x_offset + x_offsets[i], "y": y_offset + y_offsets[i]}})
        for i in range(0,8):
            t = i+8
            if (i%2 == 0):
                priority = 0.5
                source = i
                dest = t
            else:
                priority = 1
                source = t
                dest = i
            ctrlPoint = 80
            edges.append({"source": v_start+source, "dest": v_start+dest, "speed": roundabout_speed, "ctrlX": x_offset + (ctrlPoint if (i+3) % 8 >= 4 else 0), "ctrlY": y_offset + (ctrlPoint if (i+1) % 8 >= 4 else 0), "priorities": [priority]})
        for i in range(8, 16):
            t = 8+(i+1)%8
            edges.append({"source": v_start+t, "dest": v_start+i, "speed": roundabout_speed, "ctrlX": x_offset+40, "ctrlY": y_offset+40})
        return vertexIds
    elif (intersection_type == IntersectionType.ROUDNABOUT and multi_lane):
        raise NotImplementedError("Multi lane rounabout has not yet been implemented")

# Main code begins
options = parse_options()
count_x = options.count_x
count_y = options.count_y
intersection_type = options.intersection_type
output_file = options.output
multi_lane = options.lanes

x_offsets = []
y_offsets = []

width = INTERSECTION_WIDTH * count_x + 2 * BORDER_WIDTH
height = INTERSECTION_HEIGHT * count_y + 2 * BORDER_HEIGHT

positions = [37, 45, 55, 63] if multi_lane else [45, 55]

# Procedurally generate offsets for border nodes
for i in range(0, count_x):
    x_offsets.extend([p + BORDER_WIDTH + i * INTERSECTION_WIDTH for p in positions])
    y_offsets.extend([0] * (4 if multi_lane else 2))
for i in range(0, count_y):
    x_offsets.extend([2 * BORDER_WIDTH + count_x * INTERSECTION_WIDTH] * (4 if multi_lane else 2))
    y_offsets.extend([p + BORDER_HEIGHT + i * INTERSECTION_HEIGHT for p in positions])
for i in range(count_x-1, -1, -1):
    x_offsets.extend([p + BORDER_WIDTH + i * INTERSECTION_WIDTH for p in positions[::-1]])
    y_offsets.extend([2 * BORDER_HEIGHT + count_y * INTERSECTION_HEIGHT] * (4 if multi_lane else 2))
for i in range(count_y-1, -1, -1):
    x_offsets.extend([0] * (4 if multi_lane else 2))
    y_offsets.extend([p + BORDER_HEIGHT + i * INTERSECTION_HEIGHT for p in positions[::-1]])    

border_count = 4*(count_x+count_y)*(2 if multi_lane else 1)

# Create each border node with ids starting at 0
for i in range(0, border_count):
    vertices.append({"id": i, "location": {"x": x_offsets[i], "y": y_offsets[i]}, "source": i/(2 if multi_lane else 1)%2 < 1, "dest": i/(2 if multi_lane else 1)%2 >= 1})

# Add intersections and save entrypoints
intersection_entrypoints = [[] for x in range(count_x)]
for x in range(0,count_x):
    for y in range(0,count_y):
        entrypoints = generate_intersection(len(vertices), BORDER_WIDTH + INTERSECTION_WIDTH * x, BORDER_HEIGHT + INTERSECTION_HEIGHT * y, intersection_type)
        intersection_entrypoints[x].append(entrypoints)

# Add all required edges
# This could maybe be optimized...
for x in range(0, count_x):
    if (multi_lane):
        v = 4 * x
        e1 = {"source": v, "dest": intersection_entrypoints[x][0][0]}
        e2 = {"source": v+1, "dest": intersection_entrypoints[x][0][1]}
        e3 = {"source": intersection_entrypoints[x][0][2], "dest": v+2}
        e4 = {"source": intersection_entrypoints[x][0][3], "dest": v+3}
        lanes.extend([{"entries": [e1, e2]}, {"entries": [e3, e4]}])
        edges.extend([e1, e2, e3, e4])
    else:
        v = 2*x
        edges.append({"source": v, "dest": intersection_entrypoints[x][0][0]})
        edges.append({"source": intersection_entrypoints[x][0][1], "dest": v+1})

for y in range(0, count_y):
    if (multi_lane):
        v = border_count - 4 * (y+1)
        e1 = {"source": v, "dest": intersection_entrypoints[0][y][12]}
        e2 = {"source": v+1, "dest": intersection_entrypoints[0][y][13]}
        e3 = {"source": intersection_entrypoints[0][y][14], "dest": v+2}
        e4 = {"source": intersection_entrypoints[0][y][15], "dest": v+3}
        lanes.extend([{"entries": [e1, e2]}, {"entries": [e3, e4]}])
        edges.extend([e1, e2, e3, e4])
    else:
        v = border_count - 2 * (y+1)
        edges.append({"source": v, "dest": intersection_entrypoints[0][y][6]})
        edges.append({"source": intersection_entrypoints[0][y][7], "dest": v+1})

for x in range(0, count_x):
    for y in range(0, count_y):
        if (x+1 != count_x):
            if (multi_lane):
                e1 = {"source": intersection_entrypoints[x][y][6], "dest": intersection_entrypoints[x+1][y][13]}
                e2 = {"source": intersection_entrypoints[x][y][7], "dest": intersection_entrypoints[x+1][y][12]}
                e3 = {"source": intersection_entrypoints[x+1][y][15], "dest": intersection_entrypoints[x][y][4]}
                e4 = {"source": intersection_entrypoints[x+1][y][14], "dest": intersection_entrypoints[x][y][5]}
                lanes.extend([{"entries": [e1, e2]}, {"entries": [e3, e4]}])
                edges.extend([e1, e2, e3, e4])
            else:
                edges.append({"source": intersection_entrypoints[x][y][3], "dest": intersection_entrypoints[x+1][y][6]})
                edges.append({"source": intersection_entrypoints[x+1][y][7], "dest": intersection_entrypoints[x][y][2]})
        else:
            if (multi_lane):
                edge_offset = 4 * (count_x + y)
                e1 = {"source": edge_offset, "dest": intersection_entrypoints[x][y][4]}
                e2 = {"source": edge_offset+1, "dest": intersection_entrypoints[x][y][5]}
                e3 = {"source": intersection_entrypoints[x][y][6], "dest": edge_offset+2}
                e4 = {"source": intersection_entrypoints[x][y][7], "dest": edge_offset+3}
                lanes.extend([{"entries": [e1, e2]}, {"entries": [e3, e4]}])
                edges.extend([e1, e2, e3, e4])
            else:
                edge_offset = 2 * (count_x + y)
                edges.append({"source": intersection_entrypoints[x][y][3], "dest": edge_offset + 1})
                edges.append({"source": edge_offset, "dest": intersection_entrypoints[x][y][2]})
        if (y+1 != count_y):
            if (multi_lane):
                e1 = {"source": intersection_entrypoints[x][y][11], "dest": intersection_entrypoints[x][y+1][0]}
                e2 = {"source": intersection_entrypoints[x][y][10], "dest": intersection_entrypoints[x][y+1][1]}
                e3 = {"source": intersection_entrypoints[x][y+1][2], "dest": intersection_entrypoints[x][y][9]}
                e4 = {"source": intersection_entrypoints[x][y+1][3], "dest": intersection_entrypoints[x][y][8]}
                lanes.extend([{"entries": [e1, e2]}, {"entries": [e3, e4]}])
                edges.extend([e1, e2, e3, e4])
            else:
                edges.append({"source": intersection_entrypoints[x][y][5], "dest": intersection_entrypoints[x][y+1][0]})
                edges.append({"source": intersection_entrypoints[x][y+1][1], "dest": intersection_entrypoints[x][y][4]})
        else:
            if (multi_lane):
                edge_offset = 4 * (count_x + count_y + (count_x - 1 - x))
                e1 = {"source": edge_offset, "dest": intersection_entrypoints[x][y][8]}
                e2 = {"source": edge_offset+1, "dest": intersection_entrypoints[x][y][9]}
                e3 = {"source": intersection_entrypoints[x][y][10], "dest": edge_offset+2}
                e4 = {"source": intersection_entrypoints[x][y][11], "dest": edge_offset+3}
                lanes.extend([{"entries": [e1, e2]}, {"entries": [e3, e4]}])
                edges.extend([e1, e2, e3, e4])
            else:
                edge_offset = 2 * (count_x + count_y + (count_x - 1 - x))
                edges.append({"source": intersection_entrypoints[x][y][5], "dest": edge_offset+1})
                edges.append({"source": edge_offset, "dest": intersection_entrypoints[x][y][4]})

# Save output to specified file, overwriting any contents that existed previously
output = {"vertices": vertices, "edges": edges, "intersections": intersections, "lanes": lanes, "width": width, "height": height}
with open(output_file, 'w+') as f:
    json.dump(output, f)


