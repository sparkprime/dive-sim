let up_pressed = false;
let down_pressed = false;
let left_pressed = false;
let right_pressed = false;
let left_sq_pressed = false;
let right_sq_pressed = false;
let enter_pressed = false;
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

let water_density_kg_l = 1.025;
let air_density_kg_l = 0.0012;
let max_depth = 35;

let body_mass_kg = 80;
let body_displacement_l = 77;
let rest_o2_consumption_l_s = 0.003;
let swim_o2_consumption_l_s = 0.02;
let lung_capacity_l = 6;
let lung_residual_volume_l = 1.2;
let breathe_rate_l_s = 3;
let weights_mass_kg = 6;
let ear_rupture_bar = 0.5;
let ear_no_equalize_bar = 0.3;
let ear_equalize_rate_bar_s = 0.1;
let swim_speed_m_s = 0.8;

let tank_o2_conc = 0.2095;
let tank_contents_l = 2200;  // Before being compressed into the tank.
let tank_volume_l = 10;  // At 1 ATM.
let tank_mass_kg = 15;
let tank_displacement_l = 17;

let bcd_mass_kg = 5;
let bcd_empty_displacement_l = 7;
let bcd_max_contents_l = 8;
let bcd_fill_rate_l_s = 6;
let bcd_dump_rate_l_s = 4;

let game_state = 'RUNNING';
let distance_m = 0;
let direction = 1;  // Right, or -1 to go left.
let lung_volume_l = 0.5 * lung_capacity_l;
let ear_bar = 1.01325;
let lung_o2_conc = 0.19;
let bcd_contents_l = 9;
let height_m = 0;  // Negative means underwater.
let min_height_m = 0;  // For max depth this dive.
let vertical_velocity_m_s = 0;
let dive_time_s = 0;

function pressure_bar() {
    if (height_m >= 0) {
        return 1.01325;
    } else {
        return 1.01325 - height_m / 10;
    }
}

function tank_gauge() {
    return Math.max(0, tank_contents_l / tank_volume_l - pressure_bar());
}

function total_mass_kg() {
    return body_mass_kg + weights_mass_kg + tank_mass_kg
           + air_density_kg_l * tank_contents_l + bcd_mass_kg;
}

function bouyancy_n() {
    let displacement_l = body_displacement_l + tank_displacement_l + bcd_empty_displacement_l
                       + bcd_contents_l + lung_volume_l;
    return (displacement_l * water_density_kg_l - total_mass_kg()) * 9.8;
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

        dive_time_s += elapsed_s;
    }
}

function color_from_ratio(ratio) {
    if (ratio < .25) {
        return 'red';
    } else if (ratio < .50) {
        return 'yellow';
    } else {
        return 'green';
    }
}

function format_number(number, digits, dec) {
    let len = digits + dec + (dec > 0 ? 1 : 0);
    return ('0'.repeat(digits) + number.toFixed(dec)).substr(-len, len);
}

function update_view() {

    let info = document.getElementById('info');
    if (game_state == 'RUNNING') {
        let gauge_needle = document.getElementById('gauge-needle');
        gauge_needle.style['transform'] = 'rotate(' + (tank_gauge() / 50 * 30) + 'deg)';

        let diver = document.getElementById('diver');
        diver.style['top'] = (-height_m / max_depth) * 100 + '%';
        diver.style['left'] = (distance_m + 20) * 10 + 'px';
        if (direction > 0) {
            diver.style['transform'] = 'scale(1, 1)';
        } else {
            diver.style['transform'] = 'scale(-1, 1)';
        }

        blood_o2_status = null;
        if (blood_o2_sat > 0.95) {
            blood_o2_status = '0deg';
        } else if (blood_o2_sat > 0.925) {
            blood_o2_status = '-20deg';
        } else if (blood_o2_sat > 0.9) {
            blood_o2_status = '-40deg';
        } else if (blood_o2_sat > 0.875) {
            blood_o2_status = '-60deg';
        } else if (blood_o2_sat > 0.85) {
            blood_o2_status = '-80deg';
        } else if (blood_o2_sat > 0.8) {
            blood_o2_status = '-110deg';
        }

        document.getElementById('breathless-warning').style['visibility'] =
            blood_o2_sat < 0.825 && (dive_time_s * 3) % 1 > 0.7 ? 'visible' : 'hidden';

        let lung_scale = 0.5 + 0.5 * (lung_volume_l / lung_capacity_l);
        document.getElementById('expansion-injury-warning').style['visibility'] =
            lung_scale > 1.015 && (dive_time_s * 3) % 1 > 0.7 ? 'visible' : 'hidden';
        let lungs = document.getElementsByClassName('lung-foreground');
        for (let lung of lungs) {
            lung.style['transform'] = 'scale(' + lung_scale + ', ' + lung_scale + ')';
            lung.style['filter'] = 'hue-rotate(' + blood_o2_status + ')';
        }

        document.getElementById('depth').innerHTML = format_number(-height_m, 2, 1);
        document.getElementById('max-depth').innerHTML = format_number(-min_height_m, 2, 1);
        document.getElementById('dive-time').innerHTML = format_number(dive_time_s / 60, 2, 0);
        document.getElementById('no-deco-time').innerHTML = format_number(99, 2, 0);


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
            '<td>' + (bcd_contents_l / bcd_max_contents_l * 100).toFixed(0) + '%</td>',
            '</tr>',

            '<tr>',
            '<td>Ears:</td>',
            '<td>' + ear_status + '</td>',
            '</tr>',
            '<tr>',

            '</table>',
        ].join('');
    } else {
        info.innerHTML = 'Game over. Type: ' + game_state;
    }
}

function tick() {
    update_simulation(10 / 1000);
    update_view();
}

function start_simulation() {
    setInterval(tick, 10); // Time in milliseconds
}

