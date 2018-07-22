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
let resting_o2_consumption_l_s = 0.003;
let swimming_o2_consumption_l_s = 0.03;
let lung_capacity_l = 6;
let lung_residual_volume_l = 1.2;
let breathe_rate_l_s = 3;
let weights_mass_kg = 6;

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
let lung_volume_l = 0.5 * lung_capacity_l;
let ear_bar = 1.01325;
let lung_o2_conc = 0.19;
let bcd_contents_l = 9;
let swimming = false;
let height_m = 0;  // Negative means underwater.
let vertical_velocity_m_s = 0;

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
        lung_o2_l -= elapsed_s * (
            swimming ? swimming_o2_consumption_l_s : resting_o2_consumption_l_s);

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
        vertical_velocity_m_s = (
            vertical_velocity_m_s
            + 0.01 * Math.sign(-vertical_velocity_m_s) * vertical_velocity_m_s * vertical_velocity_m_s);

        // Terminal velocity.
        vertical_velocity_m_s = Math.max(-2, Math.min(2, vertical_velocity_m_s));

        // Integrate motion.
        height_m += vertical_velocity_m_s * elapsed_s;

        // De/compression of air spaces.
        let pressure_differential = pressure_bar() / old_pressure_bar;
        lung_volume_l /= pressure_differential;
        bcd_contents_l /= pressure_differential;


        if (enter_pressed && !up_pressed  && !down_pressed) {
            let diff = pressure_bar() - ear_bar;
        }

        // Game state changes:
        if (blood_o2_sat <= 0.8) {
            game_state = 'ASPHYXIATED';
        }
        if (lung_volume_l / lung_capacity_l > 1.1) {
            game_state = 'EXPANSION_INJURY';
        }
        if (height_m < -35) {
            game_state = 'COLLIDED_BOTTOM';
        }
        if (Math.abs(ear_bar - pressure_bar()) > 0.5) {
            game_state = 'RUPTURED_EARDRUM';
        }
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

function dial(ratio, color_func) {
    return '<td><div class=dial><div style="width: ' + (ratio * 100).toFixed(0) + '%; background-color: ' + color_func(ratio) + '"></div></div></td>';
}

function update_view() {
    let info = document.getElementById('info');
    if (game_state == 'RUNNING') {
        let diver = document.getElementById('diver');
        diver.style['top'] = (-height_m / max_depth) * 100 + '%';
        diver.style['left'] = (distance_m + 3) * 10 + 'px';

        blood_o2_dial_pc = (blood_o2_sat - 0.8) / 0.2 * 100;
        info.innerHTML = [
            '<table>',

            '<tr>',
            '<td>Blood O2 saturation:</td>',
            '<td>' + (blood_o2_sat * 100).toFixed(1) + '%</td>',
            dial((blood_o2_sat - 0.8) / 0.2, color_from_ratio),
            '</tr>',

            '<tr>',
            '<td>Lung expansion:</td>',
            '<td>' + (lung_volume_l / lung_capacity_l * 100).toFixed(0) + '%</td>',
            '</tr>',

            '<tr>',
            '<td>Tank pressure gauge:</td>',
            '<td>' + (tank_gauge()).toFixed(1) + ' bar</td>',
            dial(tank_gauge() / 220, color_from_ratio),
            '</tr>',

            '<tr>',
            '<td>BCD inflation:</td>',
            '<td>' + (bcd_contents_l / bcd_max_contents_l * 100).toFixed(0) + '%</td>',
            '</tr>',

            '<tr>',
            '<td>Depth:</td>',
            '<td>' + (-height_m).toFixed(2) + ' m</td>',
            '</tr>',
            '<tr>',

            '<tr>',
            '<td>Ear - ambient pressure:</td>',
            '<td>' + (ear_bar - pressure_bar()).toFixed(2) + ' bar</td>',
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

