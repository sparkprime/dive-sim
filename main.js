var topo_path;

var water_density_kg_l = 1.025;
var air_density_kg_l = 0.0012;
var max_depth = 40;
var god_mode = false;
var topo_coords = [];

var body_mass_kg = 80;
var body_displacement_l = 77;
var rest_o2_consumption_l_s = 0.003;
var swim_o2_consumption_l_s = 0.02;
var lung_capacity_l = 6;
var lung_residual_volume_l = 1.2;
var breathe_rate_l_s = 3;
var weights_mass_kg = 6;
var ear_rupture_bar = 0.5;
var ear_no_equalize_bar = 0.3;
var ear_equalize_rate_bar_s = 0.1;
var swim_speed_m_s = 0.8;

var tank_o2_conc = 0.2095;
var tank_contents_l = 2200;  // Before being compressed into the tank.
var tank_volume_l = 10;  // At 1 ATM.
var tank_mass_kg = 15;
var tank_displacement_l = 17;

var bcd_mass_kg = 5;
var bcd_empty_displacement_l = 7;
var bcd_max_contents_l = 8;
var bcd_fill_rate_l_s = 6;
var bcd_dump_rate_l_s = 4;

var game_state = 'RUNNING';
var distance_m = 12;
var direction = 1;  // Right, or -1 to go left.
var lung_volume_l = 0.5 * lung_capacity_l;
var ear_bar = 1.01325;
var lung_o2_conc = 0.19;
var bcd_contents_l = 9;
var height_m = 0;  // Negative means underwater.
var min_height_m = 0;  // For max depth this dive.
var vertical_velocity_m_s = 0;
var dive_time_s = 0;
var paused = false;

function pressure_bar() {
    if (height_m >= 0) {
        return 1.01325;
    } else {
        return 1.01325 - height_m / 10;
    }
}

function total_mass_kg() {
    return body_mass_kg + weights_mass_kg + tank_mass_kg
           + air_density_kg_l * tank_contents_l + bcd_mass_kg;
}

function bouyancy_n() {
    let displacement_l =
        body_displacement_l + tank_displacement_l + bcd_empty_displacement_l
        + bcd_contents_l + lung_volume_l;
    return (displacement_l * water_density_kg_l - total_mass_kg()) * 9.8;
}

var up_pressed = false;
var down_pressed = false;
var left_pressed = false;
var right_pressed = false;
var left_sq_pressed = false;
var right_sq_pressed = false;
var enter_pressed = false;

document.onkeydown = function(e) {
    e = e || window.event;
    if (e.keyCode == 38) {
        up_pressed = true;
    } else if (e.keyCode == 40) {
        down_pressed = true;
    } else if (e.keyCode == 37) {
        left_pressed = true;
    } else if (e.keyCode == 39) {
        right_pressed = true;
    } else if (e.keyCode == 219) {
        left_sq_pressed = true;
    } else if (e.keyCode == 221) {
        right_sq_pressed = true;
    } else if (e.keyCode == 13) {
        enter_pressed = true;
    } else {
        // console.log(e.keyCode);
    }
}
document.onkeyup = function(e) {
    e = e || window.event;
    if (e.keyCode == 38) {
        up_pressed = false;
    } else if (e.keyCode == 40) {
        down_pressed = false;
    } else if (e.keyCode == 37) {
        left_pressed = false;
    } else if (e.keyCode == 39) {
        right_pressed = false;
    } else if (e.keyCode == 219) {
        left_sq_pressed = false;
    } else if (e.keyCode == 221) {
        right_sq_pressed = false;
    } else if (e.keyCode == 13) {
        enter_pressed = false;
    }
}

function update_simulation(elapsed_s) {
    if (game_state == 'RUNNING') {
        if (left_sq_pressed && !right_sq_pressed) {
            // Dump air from BCD.
            bcd_contents_l -= bcd_dump_rate_l_s * elapsed_s;
            if (bcd_contents_l < 0) {
                bcd_contents_l = 0;
            }
        } else if (right_sq_pressed && !left_sq_pressed) {
            // Inflate BCD via LPI.
            let inflation_l = bcd_fill_rate_l_s * elapsed_s;
            inflation_l = Math.min(
                inflation_l, tank_contents_l - pressure_bar() * tank_volume_l);
            if (inflation_l < 0) {
                // This can happen when the tank was emptied and then sunk.
                inflation_l = 0;
            }
            bcd_contents_l += inflation_l;
            tank_contents_l -= inflation_l * pressure_bar();
        }
        if (bcd_contents_l > bcd_max_contents_l) {
            // Safety valve opens.
            bcd_contents_l = bcd_max_contents_l;
        }

        if (up_pressed && !down_pressed && !enter_pressed) {
            // Breathe in from tank.
            let inhaled_l = elapsed_s * breathe_rate_l_s;
            if (lung_volume_l >= lung_capacity_l) inhaled_l = 0;
            inhaled_l = Math.min(
                inhaled_l, tank_contents_l - pressure_bar() * tank_volume_l);
            if (inhaled_l < 0) {
                // This can happen when the tank was emptied and then sunk.
                inhaled_l = 0;
            }
            let old_o2 = lung_volume_l * lung_o2_conc;
            let new_o2 = inhaled_l * tank_o2_conc;
            lung_volume_l += inhaled_l;
            tank_contents_l -= inhaled_l * pressure_bar();
            lung_o2_conc = (old_o2 + new_o2) / lung_volume_l;
        } else if (down_pressed && !up_pressed && !enter_pressed) {
            // Breathe out (bubbles).
            lung_volume_l -= elapsed_s * breathe_rate_l_s;
            if (lung_volume_l < lung_residual_volume_l) lung_volume_l = lung_residual_volume_l;
        }

        // Lung O2 transfer.
        let lung_o2_l = lung_o2_conc * lung_volume_l;

        // Metabolism.
        let swimming = left_pressed || right_pressed;
        lung_o2_l -= elapsed_s * (
            swimming ? swim_o2_consumption_l_s : rest_o2_consumption_l_s);

        lung_o2_conc = lung_o2_l / lung_volume_l;
        blood_o2_sat = 0.8 + ((lung_o2_conc - 0.06) / (tank_o2_conc - 0.06)) * 0.2

        // Bouyancy
        let old_pressure_bar = pressure_bar();
        let vertical_acceleration_m_s_s = bouyancy_n() / total_mass_kg();
        vertical_velocity_m_s += vertical_acceleration_m_s_s * elapsed_s;
        if (height_m >= 0) {
            // Cannot float above the surface.
            height_m = 0;
            if (vertical_velocity_m_s >= 0) {
                vertical_velocity_m_s = 0;
            }
        }
        // Drag.
        vertical_velocity_m_s = vertical_velocity_m_s + (
            0.01 * Math.sign(-vertical_velocity_m_s) * vertical_velocity_m_s
            * vertical_velocity_m_s);

        // Integrate motion.
        height_m += vertical_velocity_m_s * elapsed_s;

        if (height_m < min_height_m) {
            min_height_m = height_m;
        }

        // De/compression of air spaces.
        let pressure_differential = pressure_bar() / old_pressure_bar;
        lung_volume_l /= pressure_differential;
        bcd_contents_l /= pressure_differential;


        // Equalizing is automatic on accent.
        let equalizing = enter_pressed && !up_pressed  && !down_pressed
                         || pressure_bar() < ear_bar;
        if (equalizing) {
            let diff_bar = pressure_bar() - ear_bar;
            if (diff_bar < ear_no_equalize_bar) {
                diff_bar = Math.min(
                    diff_bar, ear_equalize_rate_bar_s * elapsed_s);
                ear_bar += diff_bar;
            }
        }

        if (left_pressed && !right_pressed) {
            direction = -1;
            distance_m -= swim_speed_m_s * elapsed_s;
        } else if (right_pressed && !left_pressed) {
            direction = 1;
            distance_m += swim_speed_m_s * elapsed_s;
        }

        // Game state changes:
        if (!god_mode) {
            if (blood_o2_sat <= 0.8) {
                game_state = 'ASPHYXIATED';
            }
            if (lung_volume_l / lung_capacity_l > 1.1) {
                game_state = 'LUNG_EXPANSION_INJURY';
            }
            if (height_m < -35) {
                game_state = 'COLLIDED_WITH_CORAL';
            }
            if (Math.abs(ear_bar - pressure_bar()) > ear_rupture_bar) {
                game_state = 'RUPTURED_EARDRUM';
            }
        }

        dive_time_s += elapsed_s;
    }
}

function dot_product(x1, y1, x2, y2) {
    return x1 * x2 + y1 * y2;
}

function distance_line_to_diver(x1, y1, x2, y2, px, py) {
    // Find t, the parameter of the line that is nearest to (px, py).
    // If 0 <= t <= 1 then this is the right place, otherwise we need to
    // clip it to the ends of the line.
    let t = dot_product(px - x1, py - y1, x2 - x1, y2 - y1)
          / dot_product(x2 - x1, y2 - y1, x2 - x1, y2 - y1);
    t = Math.min(1, Math.max(0, t));
    let lx = x1 + t * (x2 - x1);
    let ly = y1 + t * (y2 - y1);
    // scale up y contribution to compensate for the fact that the diver
    // is more like an oval than a circle.
    return Math.sqrt(dot_product((lx - px) / 1, (ly - py) / 0.4,
                                 (lx - px) / 1, (ly - py) / 0.4));
}

function inside_topo(x, y) {
    // Count segment intersections of a ray escaping a concave polygon.
    let inside = false;
    for (let i = 0; i < topo_coords.length; ++i) {
        let j = (i + topo_coords.length - 1) % topo_coords.length;
        let xi = topo_coords[i][0], yi = topo_coords[i][1];
        let xj = topo_coords[j][0], yj = topo_coords[j][1];
        
        let intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function too_close(x, y) {
    let min_distance = 100000000;
    for (let i = 0; i < topo_coords.length; ++i) {
        let j = (i + topo_coords.length - 1) % topo_coords.length;
        let xi = topo_coords[i][0], yi = topo_coords[i][1];
        let xj = topo_coords[j][0], yj = topo_coords[j][1];
        let d = distance_line_to_diver(xi, yi, xj, yj, x, y);
        min_distance = Math.min(min_distance, d);
    }
    return min_distance < 1;
}

function format_number(number, digits, dec) {
    let len = digits + dec + (dec > 0 ? 1 : 0);
    return ('0'.repeat(digits) + number.toFixed(dec)).substr(-len, len);
}

function update_view() {

    let info = document.getElementById('info');
    if (game_state == 'RUNNING') {
        let gauge_needle = document.getElementById('gauge-needle');
        let tank_gauge = Math.max(
            0, tank_contents_l / tank_volume_l - pressure_bar());
        gauge_needle.style['transform'] =
            'rotate(' + (tank_gauge / 50 * 30) + 'deg)';

        let diver = document.getElementById('diver');
        diver.style['top'] =
            ((-height_m / max_depth) * 700 - diver.clientHeight / 2) + 'px';
        diver.style['left'] =
            (distance_m / 100 * 1750 - diver.clientWidth / 2) + 'px';
        if (direction > 0) {
            diver.style['transform'] = 'scale(1, 1)';
        } else {
            diver.style['transform'] = 'scale(-1, 1)';
        }

        blood_o2_status = null;
        if (blood_o2_sat > 0.95) {
            blood_o2_status = '0deg';
        } else if (blood_o2_sat > 0.925) {
            blood_o2_status = '-15deg';
        } else if (blood_o2_sat > 0.9) {
            blood_o2_status = '-35deg';
        } else if (blood_o2_sat > 0.875) {
            blood_o2_status = '-60deg';
        } else if (blood_o2_sat > 0.85) {
            blood_o2_status = '-80deg';
        } else if (blood_o2_sat > 0.8) {
            blood_o2_status = '-110deg';
        }

        let breathless_warning = document.getElementById('breathless-warning');
        if (blood_o2_sat < 0.825 && (dive_time_s * 3) % 1 > 0.7) {
            breathless_warning.style['visibility'] = 'visible';
        } else {
            breathless_warning.style['visibility'] = 'hidden';
        }

        let lung_scale = 0.5 + 0.5 * (lung_volume_l / lung_capacity_l);
        let expansion_warning = document.getElementById('expansion-warning');
        if (lung_scale > 1.015 && (dive_time_s * 3) % 1 > 0.7) {
            expansion_warning.style['visibility'] = 'visible';
        } else {
            expansion_warning.style['visibility'] = 'hidden';
        }
        let lungs = document.getElementsByClassName('lung-foreground');
        for (let lung of lungs) {
            lung.style['transform'] =
                'scale(' + lung_scale + ', ' + lung_scale + ')';
            lung.style['filter'] = 'hue-rotate(' + blood_o2_status + ')';
        }

        document.getElementById('depth').innerHTML =
            format_number(-height_m, 2, 1);
        document.getElementById('max-depth').innerHTML =
            format_number(-min_height_m, 2, 1);
        document.getElementById('dive-time').innerHTML =
            format_number(dive_time_s / 60, 2, 0);
        document.getElementById('no-deco-time').innerHTML =
            format_number(99, 2, 0);


        let ear_pain = Math.abs(ear_bar - pressure_bar());
        let ear_status = null;
        if (ear_pain < 0.1) {
            ear_status = 'OK';
        } else if (ear_pain < 0.2) {
            ear_status = 'Pressure';
        } else if (ear_pain < 0.3) {
            ear_status = 'Discomfort';
        } else if (ear_pain < 0.4) {
            ear_status = 'Pain!';
        } else if (ear_pain < 0.5) {
            ear_status = 'AGONY!';
        }
        info.innerHTML = [
            '<table>',

            '<tr>',
            '<td>BCD inflation:</td>',
            '<td>'
            + (bcd_contents_l / bcd_max_contents_l * 100).toFixed(0)
            + '%</td>',
            '</tr>',

            '<tr>',
            '<td>Ears:</td>',
            '<td>' + ear_status + '</td>',
            '</tr>',
            '<tr>',

            '<tr>',
            '<td>Inside:</td>',
            '<td>' + inside_topo(distance_m, height_m) + '</td>',
            '</tr>',
            '<tr>',

            '<tr>',
            '<td>Too close:</td>',
            '<td>' + too_close(distance_m, height_m) + '</td>',
            '</tr>',
            '<tr>',

            '</table>',
        ].join('');
    } else {
        info.innerHTML = 'Game over. Type: ' + game_state;
    }
}

function tick() {
    if (!paused) {
        update_simulation(10 / 1000);
        update_view();
    }
}

function start_simulation() {
    setInterval(tick, 10); // Time in milliseconds
}

function init() {
    let d = (
        topo
        .contentDocument.getElementsByTagName('svg')[0]
        .getElementsByTagName('g')[0]
        .getElementsByTagName('path')[0]
        .getAttribute('d'));
    let tokens = d.match(/([^ ,]+)/g);
    console.log(tokens);
    let last_x = 0, last_y = 0;
    let current = 0;
    function peek() {
        return tokens[current];
    }
    function pop() {
        return tokens[current++];
    }
    while (true) {
        let tok = pop();
        if (tok == 'M') {
            while (!isNaN(peek())) {
                last_x = Number(pop());
                last_y = Number(pop());
                topo_coords.push([last_x, -last_y]);
            }
        } else if (tok == 'm') {
            while (!isNaN(peek())) {
                last_x += Number(pop());
                last_y += Number(pop());
                topo_coords.push([last_x, -last_y]);
            }
        } else if (tok == 'Z') {
            break;
        } else if (tok == 'z') {
            break;
        } else if (tok == 'L') {
            while (!isNaN(peek())) {
                last_x = Number(pop());
                last_y = Number(pop());
                topo_coords.push([last_x, -last_y]);
            }
        } else if (tok == 'l') {
            while (!isNaN(peek())) {
                last_x += Number(pop());
                last_y += Number(pop());
                topo_coords.push([last_x, -last_y]);
            }
        } else if (tok == 'H') {
            while (!isNaN(peek())) {
                last_x = Number(pop());
                topo_coords.push([last_x, -last_y]);
            }
        } else if (tok == 'h') {
            while (!isNaN(peek())) {
                last_x += Number(pop());
                topo_coords.push([last_x, -last_y]);
            }
        } else if (tok == 'V') {
            while (!isNaN(peek())) {
                last_y = Number(pop());
                topo_coords.push([last_x, -last_y]);
            }
        } else if (tok == 'v') {
            while (!isNaN(peek())) {
                last_y += Number(pop());
                topo_coords.push([last_x, -last_y]);
            }
        } else {
            throw "Bad SVG path: " + d;
        }
    }
    console.log(topo_coords);
    start_simulation();
}
