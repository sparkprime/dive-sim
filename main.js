var water_density_kg_l = 1.025;
var air_density_kg_l = 0.0012;
var god_mode = false;
var topo_coords = [];
var bubble_rise_speed = 0.3;  // Can be more, according to randoness.
var bubble_interval = 0.1;
var max_bubbles = 100;
var zoom = 0.05;
var treasure_chest_radius = 0.75;
var treasure_chest_positions = [
    [30, -18.7],
    [21, -6.5],
    [45, -37.3],
    [75, -34.3],
    [86.4, -34.95],
];

var fish_positions = [
    [14, -3, 'clown-fish.svg', 1],
    [37, -6, 'clown-fish.svg', 1],
    [27, -3, 'clown-fish.svg', 1],
    [53, -21, 'barracuda.svg', 3],
    [71, -31, 'barracuda.svg', 3],
    [20, -33.5, 'barracuda.svg', 3],
];
var fish_zone_width = 5;
var fish_zone_height = 4;

var body_mass_kg = 80;
var body_displacement_l = 77;
var rest_o2_consumption_l_s = 0.01;
var swim_o2_consumption_l_s = 0.025;
var lung_capacity_l = 6;
var lung_residual_volume_l = 2;
var lung_volume_to_equalize_l = 2.5;
var breathe_rate_l_s = 3;
var weights_mass_kg = 6;
var ear_rupture_bar = 0.5;
var ear_no_equalize_bar = 0.3;
var ear_equalize_rate_bar_s = 0.1;
var swim_speed_m_s = 1;
var lung_dead_space_l = 0.15;

var tank_o2_conc = 0.2095;
var tank_volume_l = 10;  // At 1 ATM.
var tank_mass_kg = 15;
var tank_displacement_l = 17;

var bcd_mass_kg = 5;
var bcd_empty_displacement_l = 7;
var bcd_max_contents_l = 8;
var bcd_fill_rate_l_s = 6;
var bcd_dump_rate_l_s = 4;

var bubbles = [];

var time_since_last_bubble;
var tank_contents_l;  // Before being compressed into the tank.
var game_state;
var distance_m;
var direction;
var lung_volume_l;
var dead_space_fresh_l;  // Amount of fresh air in the dead spaces.
var ear_bar;
var lung_o2_conc;
var bcd_contents_l;
var height_m;
var min_height_m;
var vertical_velocity_m_s;
var dive_time_s;
var equalizing;
var blood_o2_sat;
var equalize_pressure_too_great;
var treasure_collected;
var n2_exposure;  // From 0 to 1, where 1 means "no-deco time all gone".
var no_deco_time_s;

function set_game_state(v) {
    game_state = v;
    splash.style['visibility'] = v == 'SPLASH' ? 'visible' : 'hidden';
    paused.style['visibility'] = v == 'PAUSED' ? 'visible' : 'hidden';
    game_over.style['visibility'] = v == 'GAME_OVER' ? 'visible' : 'hidden';
}

function toggle_pause() {
    if (game_state == 'RUNNING') {
        set_game_state('PAUSED');
    } else if (game_state == 'PAUSED') {
        set_game_state('RUNNING');
    }
}

function do_game_over(msg, title) {
    title = title || "Game over!"
    game_over_title.innerHTML = title;
    game_over_msg.innerHTML = msg;
    set_game_state('GAME_OVER');
}

var fishes = [];
var treasure_chests = [];

function update_money() {
    let imgs = [];
    for (let i = 0; i < treasure_chest_positions.length; ++i) {
        if (i < treasure_collected) {
            imgs.push('<img src=dollar.svg class=dollar_found>')
        } else {
            imgs.push('<img src=dollar.svg class=dollar>')
        }
    }
    money.innerHTML = imgs.join('');
}

function make_img(filename, class_name, x, y) {
    let img = document.createElement('IMG');
    img.src = filename;
    img.className = class_name;
    img.spriteX = x;
    img.spriteY = y;
    img.onload = function() {
        position(img, img.spriteX, img.spriteY, 1);
    }
    world.appendChild(img);
    return img;
}

function reset_fish() {
    for (let fish of fishes) {
        world.removeChild(fish);
    }
    fishes = [];
    for (let fish_pos of fish_positions) {
        let fish = make_img(fish_pos[2], 'sprite', fish_pos[0], fish_pos[1]);
        fish.speed = fish_pos[3];
        fish.velocityX = fish.speed * 0.4 * Math.random() - 0.2;
        fish.velocityY = fish.speed * 0.2 * Math.random() - 0.1;
        fishes.push(fish);
    }
}

function reset_treasure() {
    for (let chest of treasure_chests) {
        world.removeChild(chest);
    }
    treasure_chests = [];
    for (let chest_pos of treasure_chest_positions) {
        let chest = make_img('treasure.svg', 'sprite', chest_pos[0], chest_pos[1]);
        chest.empty = false;
        treasure_chests.push(chest);
    }
    treasure_collected = 0;
    update_money();
}

function test_treasure() {
    for (let i = 0; i < treasure_chest_positions.length ; ++i) {
        let chest = treasure_chests[i];
        if (chest.empty) continue;
        let chest_pos = treasure_chest_positions[i];
        let d = vect_length(distance_m - chest_pos[0], height_m - chest_pos[1]);
        if (d < treasure_chest_radius) {
            chest.src = 'treasure-empty.svg';
            chest.empty = true;
            treasure_collected++;
            update_money();
        }
    }
}

function reset_game() {
    tank_contents_l = 2200;
    distance_m = 10.5;
    direction = 1;  // Right, or -1 to go left.
    lung_volume_l = 0.5 * lung_capacity_l;
    dead_space_fresh_l = 0.5 * lung_dead_space_l;
    ear_bar = 1.01325;
    lung_o2_conc = 0.19;
    bcd_contents_l = 9;
    height_m = 0;  // Negative means underwater.
    min_height_m = 0;  // For max depth this dive.
    vertical_velocity_m_s = 0;
    dive_time_s = 0;
    equalizing = false;
    equalize_pressure_too_great = false;
    blood_o2_sat = 1;
    clear_bubbles();
    reset_treasure();
    reset_fish();
    n2_exposure = 0;
    set_game_state('RUNNING');
}

function n2_exposure_rate(depth_m) {
    return Math.pow((depth_m), 2.22) * 0.00000047;
}

function pressure_bar() {
    if (height_m >= 0) {
        return 1.01325;
    } else {
        return 1.01325 - height_m / 10;
    }
}

function tank_gauge() {
    return Math.max(
        0, tank_contents_l / tank_volume_l - pressure_bar());
}

function total_mass_kg() {
    return body_mass_kg + weights_mass_kg + tank_mass_kg
           + air_density_kg_l * tank_contents_l + bcd_mass_kg;
}

function buoyancy_n() {
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
    } else if (e.keyCode == 80) {
        toggle_pause();
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

function make_bubble(elapsed_s, x, y) {
    if (bubbles.length > max_bubbles) return;
    time_since_last_bubble += elapsed_s;
    if (time_since_last_bubble < bubble_interval) return;
    time_since_last_bubble -= bubble_interval;
    let bubble = make_img('bubble.svg', 'bubble', x, y);
    bubble.bubbleRandom = Math.random();
    bubbles.push(bubble);
}

function regulator_bubble(elapsed_s) {
    make_bubble(
        elapsed_s,
        distance_m + direction * (0.6 + 0.2 * Math.random()),
        height_m - 0.2 + 0.1 * Math.random());
}

function lpi_bubble(elapsed_s) {
    make_bubble(
        elapsed_s,
        distance_m + direction * (0.6 + 0.2 * Math.random()),
        height_m + 0.1 + 0.1 * Math.random());
}

function bcd_safety_valve_bubble(elapsed_s) {
    make_bubble(
        elapsed_s,
        distance_m + direction * (-0.3 + 0.2 * Math.random()),
        height_m + 0.2 + 0.2 * Math.random());
}

function remove_bubble(i) {
    world.removeChild(bubbles[i]);
    bubbles[i] = bubbles[bubbles.length - 1];
    bubbles.pop();  // Hehe.
}

function clear_bubbles() {
    time_since_last_bubble = 0;
    while (bubbles.length > 0) {
        remove_bubble(0);
    }
}

function position(node, x, y, direction) {
    if (direction >= 0) {
        node.style['transform'] = 'scale(1, 1)';
    } else {
        node.style['transform'] = 'scale(-1, 1)';
    }
    // Pixels are actually millimetres.
    node.style.left = (x * 1000 - node.clientWidth / 2) + 'px'
    node.style.top = (-y * 1000 - node.clientHeight / 2) + 'px'
}

function pan_depth(x, y, obj, qty) {
    x *= zoom * 1000;
    y *= zoom * 1000;
    x -= document.body.clientWidth / 2;
    y += document.body.clientHeight / 2;
    if (x < 0) x = 0;
    x = Math.min(x, 100 * zoom * 1000 - document.body.clientWidth);
    x *= qty;
    y = Math.max(y, -40 * zoom * 1000 + document.body.clientHeight);
    obj.style.transform =
        'translate(' + (-x) + 'px, ' + y + 'px) '
        + 'scale(' + zoom + ', ' + zoom + ')';
}

function pan(x, y) {
    x = Math.max(0, Math.min(100, x));
    y = Math.max(-40, Math.min(0, y));
    pan_depth(x, y, world, 1);
    pan_depth(x, y, world1, 0.7);
    pan_depth(x, y, world2, 0.35);
}

function update_bubbles(elapsed_s) {
    for (let i = 0; i < bubbles.length; ++i) {
        let bubble = bubbles[i];
        // Physics
        if (bubble.spriteY > 0) {
            remove_bubble(i);
            i--;
            continue;
        }
        bubble.spriteY +=
            (bubble_rise_speed + 0.2 * bubble.bubbleRandom) * elapsed_s;

        // Graphics
        position(bubble, bubble.spriteX, bubble.spriteY, 1);
    } 
}

function update_fish(elapsed_s) {
    for (let i = 0; i < fishes.length; ++i) {
        let fish = fishes[i];
        let fish_centre = fish_positions[i];
        fish.spriteX += fish.speed * fish.velocityX * elapsed_s;
        fish.spriteY += fish.speed * fish.velocityY * elapsed_s;
        if (Math.random() < 0.01) {
            fish.velocityX = 0.2 * Math.random() * Math.sign(fish.velocityX);
            fish.velocityY = 0.2 * Math.random() - 0.1;
        }
        if (fish.spriteY > -1
            || fish.spriteY > fish_centre[1] + fish_zone_height) {
            fish.velocityY = -1 * Math.max(0.05, Math.abs(fish.velocityY));
        }
        if (fish.spriteY < fish_centre[1] - fish_zone_height) {
            fish.velocityY = 1 * Math.max(0.05, Math.abs(fish.velocityY));
        }
        if (fish.spriteX > fish_centre[0] + fish_zone_width) {
            fish.velocityX = -1 * Math.max(0.05, Math.abs(fish.velocityX));
        }
        if (fish.spriteX < fish_centre[0] - fish_zone_width) {
            fish.velocityX = 1 * Math.max(0.05, Math.abs(fish.velocityX));
        }

        // Graphics
        let direction = fish.velocityX;
        position(fish, fish.spriteX, fish.spriteY, direction);
    } 
}

function dot_product(x1, y1, x2, y2) {
    return x1 * x2 + y1 * y2;
}

function vect_length2(x, y) {
    return dot_product(x, y, x, y);
}

function vect_length(x, y) {
    return Math.sqrt(vect_length2(x, y));
}

function distance_line_to_diver(x1, y1, x2, y2, px, py) {
    // Find t, the parameter of the line that is nearest to (px, py).
    // If 0 <= t <= 1 then this is the right place, otherwise we need to
    // clip it to the ends of the line.
    let t = dot_product(px - x1, py - y1, x2 - x1, y2 - y1)
          / vect_length2(x2 - x1, y2 - y1);
    t = Math.min(1, Math.max(0, t));
    let lx = x1 + t * (x2 - x1);
    let ly = y1 + t * (y2 - y1);
    // scale up y contribution to compensate for the fact that the diver
    // is more like an oval than a circle.
    return Math.sqrt(dot_product((lx - px) / 0.8, (ly - py) / 0.3,
                                 (lx - px) / 0.8, (ly - py) / 0.3));
}

/** Are we inside any topo polygon? */
function inside_topo(x, y) {
    // Count segment intersections of a ray escaping a concave polygon.
    for (let poly of topo_coords) {
        let inside_this_poly = false;
        for (let i = 0; i < poly.length; ++i) {
            let j = (i + poly.length - 1) % poly.length;
            let xi = poly[i][0], yi = poly[i][1];
            let xj = poly[j][0], yj = poly[j][1];
            
            let intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside_this_poly = !inside_this_poly;
        }
        if (inside_this_poly) return true;
    }
    return false;
}

/** Are we too close to any polygon line? */
function too_close(x, y) {
    let min_distance = 100000000;
    for (let poly of topo_coords) {
        for (let i = 0; i < poly.length; ++i) {
            let j = (i + poly.length - 1) % poly.length;
            let xi = poly[i][0], yi = poly[i][1];
            let xj = poly[j][0], yj = poly[j][1];
            let d = distance_line_to_diver(xi, yi, xj, yj, x, y);
            min_distance = Math.min(min_distance, d);
        }
    }
    return min_distance < 1;
}

function update_simulation(elapsed_s) {
    if (left_sq_pressed && !right_sq_pressed) {
        // Dump air from BCD.
        bcd_contents_l -= bcd_dump_rate_l_s * elapsed_s;
        if (bcd_contents_l < 0) {
            bcd_contents_l = 0;
        } else {
            lpi_bubble(elapsed_s);
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
        bcd_safety_valve_bubble(elapsed_s);
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
        let after_dead_space = Math.max(
            0, inhaled_l - (lung_dead_space_l - dead_space_fresh_l));
        dead_space_fresh_l += inhaled_l - after_dead_space;
        inhaled_l = after_dead_space;
        let old_o2 = lung_volume_l * lung_o2_conc;
        let new_o2 = inhaled_l * tank_o2_conc;
        lung_volume_l += inhaled_l;
        tank_contents_l -= inhaled_l * pressure_bar();
        lung_o2_conc = (old_o2 + new_o2) / lung_volume_l;

    } else if (down_pressed && !up_pressed && !enter_pressed) {
        // Breathe out.
        let exhaled_air_l = elapsed_s * breathe_rate_l_s;
        if (lung_volume_l - exhaled_air_l < lung_residual_volume_l) {
            exhaled_air_l = lung_volume_l - lung_residual_volume_l;
        }
        if (exhaled_air_l > 0) {
            lung_volume_l -= exhaled_air_l
            regulator_bubble(elapsed_s);
            let freshness = (tank_o2_conc - lung_o2_conc) / tank_o2_conc;
            dead_space_fresh_l -= freshness * exhaled_air_l;
            if (dead_space_fresh_l < 0) {
                dead_space_fresh_l = 0;
            }
        }
    }

    // Lung O2 transfer.
    let lung_o2_l = lung_o2_conc * lung_volume_l;

    // Metabolism.
    let swimming = left_pressed || right_pressed;
    lung_o2_l -= elapsed_s * (
        swimming ? swim_o2_consumption_l_s : rest_o2_consumption_l_s);

    lung_o2_conc = lung_o2_l / lung_volume_l;
    blood_o2_sat = (
        0.8 + ((lung_o2_conc - 0.06) / (tank_o2_conc - 0.06)) * 0.2);

    // Buoyancy
    let old_pressure_bar = pressure_bar();
    let vertical_acceleration_m_s_s = buoyancy_n() / total_mass_kg();
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


    // Note: if you attempt to breathe and equalize at the same time,
    // equalizing 'wins' -- i.e., you equalize, but you don't breathe.
    equalizing = enter_pressed;
    equalize_pressure_too_great = false;
    if (equalizing) {
        let diff_bar = pressure_bar() - ear_bar;
        if (diff_bar < ear_no_equalize_bar) {
            diff_bar = Math.min(
                diff_bar, ear_equalize_rate_bar_s * elapsed_s);
            ear_bar += diff_bar;
        } else {
            equalize_pressure_too_great = true;
        }
    }

    // Equalizing is automatic on accent.
    if (pressure_bar() < ear_bar) {
        let diff_bar = pressure_bar() - ear_bar;
        diff_bar = Math.min(
            diff_bar, ear_equalize_rate_bar_s * elapsed_s);
        ear_bar += diff_bar;
    }

    if (left_pressed && !right_pressed) {
        direction = -1;
        distance_m -= swim_speed_m_s * elapsed_s;
        if (distance_m < 1) distance_m = 1;
    } else if (right_pressed && !left_pressed) {
        direction = 1;
        distance_m += swim_speed_m_s * elapsed_s;
        if (distance_m > 99) distance_m = 99;
    }

    // Nitrogen dissolved in blood system.
    if (height_m < 0) {
        n2_exposure += elapsed_s * n2_exposure_rate(-height_m);
    }
    // Nitrogen coming out of the blood naturally.
    n2_exposure -= elapsed_s * 0.000166;
    if (n2_exposure < 0) n2_exposure = 0;
    if (height_m < 0) {
        no_deco_time_s = 1 / n2_exposure_rate(-height_m) * (1 - n2_exposure);
    } else {
        // It will be clipped to 99 in the GUI.
        no_deco_time_s = 1000000000000000;
    }

    // Game state changes:
    test_treasure();
    if (!god_mode) {
        if (n2_exposure > 1) {
            do_game_over(
                '<p>You have exceeded your no-decompression limit.</p>'
                + '<p>This puts you at risk of decompression sickness '
                + '("the bends").  Lengthy emergency decompression stops are '
                + 'required on ascent, to avoid a life-threatening situation.</p>'
            );
        }
        if (blood_o2_sat <= 0.8) {
            do_game_over(
                '<p>You forgot to breathe.</p>'
                + '<p>Controlled continuous breathing is essential for good '
                + 'buoyancy control, as well as basic survival!</p>'
            );
        }
        if (lung_volume_l / lung_capacity_l > 1.1) {
            do_game_over(
                '<p>You died of a lung expansion injury.</p>'
                + '<p>When ascending, the change in environmental pressure '
                + 'causes your lungs to inflate like a balloon.  You must '
                + 'compensate by continually breathing out or potentially '
                + 'suffer a fatal injury.</p>'
            );
        }
        if (Math.abs(ear_bar - pressure_bar()) > ear_rupture_bar) {
            do_game_over(
                '<p>You suffered a ruptured ear drum.</p>'
                + '<p>When descending, the air space in your inner ear must be '
                + 'continually equalized ([enter] key) to the increasing '
                + 'environmental pressure.  Otherwise, the force pushing '
                + 'against the ear drum may rupture it, risking infection '
                + 'or permanent hearing loss.</p>'
            );
        }
        if (inside_topo(distance_m, height_m)
            || too_close(distance_m, height_m)) {
            do_game_over(
                '<p>You collided with the coral!</p>'
                + '<p>Coral takes years to grow but is very delicate.  '
                + 'Divers should never touch it, even when passing through '
                + 'narrow spaces.</p>'
            );
        }
    }

    // Can still win, even if god mode is on.
    if (height_m >= 0 && distance_m > 10.5 && distance_m < 11.5) {
        if (treasure_collected >= treasure_chest_positions.length) {
            msg = [
                '<p>You have completed your dive!</p>',
                '<table>',
                '<tr>',
                '<td>Max depth:</td>',
                '<td>' + (-min_height_m).toFixed(1) + 'm</td>',
                '</tr>',
                '<tr>',
                '<td>Dive time:</td>',
                '<td>' + Math.floor((dive_time_s / 60)) + ' minutes</td>',
                '</tr>',
                '<tr>',
                '<td>Treasure collected:</td>',
                '<td>' + treasure_collected + ' chests</td>',
                '</tr>',
                '<tr>',
                '<td>Remaining tank pressure:</td>',
                '<td>' + Math.floor(tank_gauge()) + ' bar</td>',
                '</tr>',
                '</table>',
            ]
            do_game_over(msg.join('\n'), 'Congratulations!');
        }
    }

    dive_time_s += elapsed_s;
}

function format_number(number, digits, dec) {
    let len = digits + dec + (dec > 0 ? 1 : 0);
    return ('0'.repeat(digits) + number.toFixed(dec)).substr(-len, len);
}

function update_view() {

    gauge_needle.style['transform'] =
        'rotate(' + (tank_gauge() / 50 * 30) + 'deg)';

    position(diver, distance_m, height_m, direction);

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

    if (blood_o2_sat < 0.825 && (dive_time_s * 3) % 1 > 0.7) {
        breathless_warning.style['visibility'] = 'visible';
    } else {
        breathless_warning.style['visibility'] = 'hidden';
    }

    let lung_scale = 0.5 + 0.5 * (lung_volume_l / lung_capacity_l);
    if (lung_scale > 1.015 && (dive_time_s * 3) % 1 > 0.7) {
        expansion_warning.style['visibility'] = 'visible';
    } else {
        expansion_warning.style['visibility'] = 'hidden';
    }
    let lungs = document.getElementsByClassName('lung_foreground');
    for (let lung of lungs) {
        lung.style['transform'] =
            'scale(' + lung_scale + ', ' + lung_scale + ')';
        lung.style['filter'] = 'hue-rotate(' + blood_o2_status + ')';
    }

    depth.innerHTML = format_number(-height_m, 2, 1);
    max_depth.innerHTML = format_number(-min_height_m, 2, 1);
    dive_time.innerHTML = format_number(dive_time_s / 60, 2, 0);
    no_deco_time.innerHTML =
        format_number(Math.min(99, no_deco_time_s / 60), 2, 0);

    let ear_pain_qty = Math.abs(ear_bar - pressure_bar());
    ears_pressure.style.visibility = 'hidden';
    ears_uncomfortable.style.visibility = 'hidden';
    ears_pain.style.visibility = 'hidden';
    ears_warning.style.visibility = 'hidden';
    equalize_attempt.style.visibility = 'hidden';
    equalize_failure.style.visibility = 'hidden';
    if (ear_pain_qty < 0.07) {
        // Nothing to do.
    } else if (ear_pain_qty < 0.18) {
        ears_pressure.style.visibility = 'visible';
    } else if (ear_pain_qty < 0.3) {
        ears_uncomfortable.style.visibility = 'visible';
    } else if (ear_pain_qty < 0.4) {
        ears_pain.style.visibility = 'visible';
    } else {
        ears_pain.style.visibility = 'visible';
        if ((dive_time_s * 3) % 1 > 0.7) {
            ears_warning.style['visibility'] = 'visible';
        } else {
            ears_warning.style['visibility'] = 'hidden';
        }
    }
    if (equalizing) {
        equalize_attempt.style.visibility = 'visible';
        if (equalize_pressure_too_great) {
            equalize_failure.style.visibility = 'visible';
        }
    }

    text.innerHTML =
        'BCD inflation: '
        + (bcd_contents_l / bcd_max_contents_l * 100).toFixed(0) + '%';
}

function tick() {
    let elapsed_s = 0.01;
    if (game_state == 'RUNNING') {
        update_simulation(elapsed_s);
        update_bubbles(elapsed_s);
        update_fish(elapsed_s);
        pan(distance_m, height_m)
    }
    update_view();
}

function start_simulation() {
    setInterval(tick, 10); // Time in milliseconds
}

function init_topo() {
    let topo_paths = (
        topo
        .contentDocument.getElementsByTagName('svg')[0]
        .getElementsByTagName('g')[0]
        .getElementsByTagName('path'));
    for (let topo_path of topo_paths) {
        // console.log(topo_path);
        if (!/^topo/.test(topo_path.id)) continue;
        let poly = [];
        topo_coords.push(poly);
        let tokens = topo_path.getAttribute('d').match(/([^ ,]+)/g);
        // console.log(tokens);
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
                    poly.push([last_x, -last_y]);
                }
            } else if (tok == 'm') {
                while (!isNaN(peek())) {
                    last_x += Number(pop());
                    last_y += Number(pop());
                    poly.push([last_x, -last_y]);
                }
            } else if (tok == 'Z') {
                break;
            } else if (tok == 'z') {
                break;
            } else if (tok == 'L') {
                while (!isNaN(peek())) {
                    last_x = Number(pop());
                    last_y = Number(pop());
                    poly.push([last_x, -last_y]);
                }
            } else if (tok == 'l') {
                while (!isNaN(peek())) {
                    last_x += Number(pop());
                    last_y += Number(pop());
                    poly.push([last_x, -last_y]);
                }
            } else if (tok == 'H') {
                while (!isNaN(peek())) {
                    last_x = Number(pop());
                    poly.push([last_x, -last_y]);
                }
            } else if (tok == 'h') {
                while (!isNaN(peek())) {
                    last_x += Number(pop());
                    poly.push([last_x, -last_y]);
                }
            } else if (tok == 'V') {
                while (!isNaN(peek())) {
                    last_y = Number(pop());
                    poly.push([last_x, -last_y]);
                }
            } else if (tok == 'v') {
                while (!isNaN(peek())) {
                    last_y += Number(pop());
                    poly.push([last_x, -last_y]);
                }
            } else {
                throw 'Bad SVG path: ' + topo_path.id + ': ' + d;
            }
        }
    }
    // console.log(topo_coords);
}

function init() {
    init_topo();
    start_simulation();
}

