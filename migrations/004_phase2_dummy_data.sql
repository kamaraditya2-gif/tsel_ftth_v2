-- =============================================================================
-- Phase 2: Assign cluster_nop_id ke ONT existing + Generate dummy 92 ONT
-- Total target: 122 ONT (30 existing + 92 dummy)
-- =============================================================================

DO $$
DECLARE
    dev RECORD;
    nop RECORD;
    closest_nop_id INTEGER;
    closest_dist DECIMAL;
    dist DECIMAL;
    brand TEXT;
    ont_type TEXT;
    profile TEXT;
    serial TEXT;
    device_name TEXT;
    customer_name TEXT;
    ip TEXT;
    lat_val DECIMAL;
    lng_val DECIMAL;
    v_dev_id INTEGER;
    brand_arr TEXT[] := ARRAY['Huawei', 'ZTE', 'Fiberhome', 'Nokia', 'Raisecom'];
    ont_type_arr TEXT[] := ARRAY['HG8245H', 'F670L', 'AN5506', 'G2425G-A', 'F609'];
    profile_arr TEXT[] := ARRAY['Platinum', 'Gold', 'Silver', 'Bronze'];
    speed_id_val INTEGER;
    cnt INTEGER := 0;
    existing_count INTEGER;
    alarm_type_arr TEXT[] := ARRAY['high_temp', 'pln_down', 'fo_cut', 'ne_faulty', 'capacity', 'crc_error', 'packet_loss'];
    v_alarm_type TEXT;
    severity TEXT;
    metric_val DECIMAL;
    threshold_val DECIMAL;
    alarm_msg TEXT;
    online_status TEXT;
BEGIN

    -- =========================================================================
    -- 1. Assign cluster_nop_id ke 30 ONT existing berdasarkan proximity lat/lng
    -- =========================================================================
    FOR dev IN SELECT id, lat, lng, downstream_server_id FROM devices_ont WHERE serial_number NOT LIKE 'DUMMY%' AND cluster_nop_id IS NULL LOOP
        closest_dist := 999999;
        closest_nop_id := NULL;
        
        FOR nop IN SELECT id, lat, lng, regional_id FROM master_cluster_nop WHERE regional_id = dev.downstream_server_id LOOP
            IF dev.lat IS NOT NULL AND nop.lat IS NOT NULL THEN
                dist := SQRT(POWER(dev.lat - nop.lat, 2) + POWER(dev.lng - nop.lng, 2));
                IF dist < closest_dist THEN
                    closest_dist := dist;
                    closest_nop_id := nop.id;
                END IF;
            END IF;
        END LOOP;

        IF closest_nop_id IS NOT NULL THEN
            UPDATE devices_ont SET cluster_nop_id = closest_nop_id WHERE id = dev.id;
        END IF;
    END LOOP;

    SELECT COUNT(*) INTO existing_count FROM devices_ont WHERE serial_number NOT LIKE 'DUMMY%';
    RAISE NOTICE 'Assigned cluster_nop_id to % existing ONT devices', existing_count;

    -- =========================================================================
    -- 2. Generate dummy 92 ONT (total = 122)
    -- =========================================================================
    -- Hapus dummy lama
    DELETE FROM active_alarms WHERE device_id IN (SELECT id FROM devices_ont WHERE serial_number LIKE 'DUMMY%');
    DELETE FROM alarm_history WHERE device_id IN (SELECT id FROM devices_ont WHERE serial_number LIKE 'DUMMY%');
    DELETE FROM devices_ont WHERE serial_number LIKE 'DUMMY%';

    cnt := 0;
    FOR nop IN SELECT * FROM master_cluster_nop ORDER BY id LOOP
        -- Tentukan jumlah dummy per NOP: minimal 1, sisanya merata
        FOR i IN 1..2 LOOP
            cnt := cnt + 1;
            IF cnt > 92 THEN EXIT; END IF;  -- Max 92 dummy

            brand := brand_arr[1 + floor(random() * array_length(brand_arr, 1))];
            ont_type := ont_type_arr[1 + floor(random() * array_length(ont_type_arr, 1))];
            profile := profile_arr[1 + floor(random() * array_length(profile_arr, 1))];
            serial := 'DUMMY' || LPAD(cnt::TEXT, 5, '0');
            device_name := brand || '-' || ont_type || '-' || cnt;
            customer_name := 'Pelanggan Dummy ' || cnt;
            ip := '10.' || (100 + floor(random() * 100))::TEXT || '.' || (1 + floor(random() * 254))::TEXT || '.' || (1 + floor(random() * 254))::TEXT;

            IF nop.lat IS NOT NULL THEN
                lat_val := nop.lat + (random() - 0.5) * 0.05;
                lng_val := nop.lng + (random() - 0.5) * 0.05;
            ELSE
                lat_val := NULL;
                lng_val := NULL;
            END IF;

            online_status := CASE 
                WHEN random() < 0.80 THEN 'online'
                WHEN random() < 0.95 THEN 'offline'
                ELSE 'warning'
            END;

            speed_id_val := CASE profile
                WHEN 'Platinum' THEN 1
                WHEN 'Gold' THEN 2
                WHEN 'Silver' THEN 3
                WHEN 'Bronze' THEN 4
                ELSE NULL
            END;

            INSERT INTO devices_ont (
                device_name, serial_number, mac_address, ip_address,
                cpe_type, manufacturer, model, status,
                group_id, speed_id, downstream_server_id, cluster_nop_id,
                indihome_id, lat, lng,
                created_at, updated_at
            ) VALUES (
                device_name, serial,
                'AA:' || LPAD(TO_HEX(cnt + 100), 4, '0') || ':' || LPAD(TO_HEX(cnt + 200), 4, '0'),
                ip::inet, ont_type, brand, ont_type || '-V2', online_status,
                1, speed_id_val, nop.regional_id, nop.id,
                'IH-DUMMY-' || cnt, lat_val, lng_val,
                NOW(), NOW()
            ) RETURNING id INTO v_dev_id;

            UPDATE devices_ont SET last_seen = NOW() - (random() * INTERVAL '30 minutes')
            WHERE id = v_dev_id;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Generated % dummy ONT devices (total existing + dummy = %)', cnt, existing_count + cnt;

    -- =========================================================================
    -- 3. Generate Simulated Alarms (30% device mendapat 1-3 alarm)
    -- =========================================================================
    FOR v_dev_id IN SELECT id FROM devices_ont WHERE random() < 0.3 LOOP
        FOR i IN 1..1 + floor(random() * 3) LOOP
            v_alarm_type := alarm_type_arr[1 + floor(random() * array_length(alarm_type_arr, 1))];

            CASE v_alarm_type
                WHEN 'high_temp' THEN
                    metric_val := 45 + random() * 30;
                    threshold_val := 55;
                    severity := CASE WHEN metric_val > 65 THEN 'critical' ELSE 'warning' END;
                    alarm_msg := 'Suhu tinggi: ' || ROUND(metric_val::numeric, 1) || '°C';
                WHEN 'pln_down' THEN
                    metric_val := 0;
                    threshold_val := 1;
                    severity := 'critical';
                    alarm_msg := 'PLN Down - perangkat menggunakan baterai';
                WHEN 'fo_cut' THEN
                    metric_val := 100;
                    threshold_val := 1;
                    severity := 'critical';
                    alarm_msg := 'FO Cut - kabel serat optik terputus';
                WHEN 'ne_faulty' THEN
                    metric_val := 1;
                    threshold_val := 1;
                    severity := 'critical';
                    alarm_msg := 'NE Faulty - perangkat tidak merespon';
                WHEN 'capacity' THEN
                    metric_val := 60 + random() * 35;
                    threshold_val := 70;
                    severity := CASE WHEN metric_val > 85 THEN 'critical' ELSE 'warning' END;
                    alarm_msg := 'Utilisasi kapasitas: ' || ROUND(metric_val::numeric, 1) || '%';
                WHEN 'crc_error' THEN
                    metric_val := 50 + random() * 1000;
                    threshold_val := 100;
                    severity := CASE WHEN metric_val > 1000 THEN 'critical' ELSE 'warning' END;
                    alarm_msg := 'CRC Error: ' || ROUND(metric_val::numeric, 0) || ' count';
                WHEN 'packet_loss' THEN
                    metric_val := 2 + random() * 10;
                    threshold_val := 3;
                    severity := CASE WHEN metric_val > 5 THEN 'critical' ELSE 'warning' END;
                    alarm_msg := 'Packet Loss: ' || ROUND(metric_val::numeric, 1) || '%';
            END CASE;

            INSERT INTO active_alarms (device_id, alarm_type, metric_value, threshold_value, severity, message, triggered_at, last_checked_at)
            VALUES (v_dev_id, v_alarm_type, metric_val, threshold_val, severity, alarm_msg,
                    NOW() - (random() * INTERVAL '2 hours'), NOW())
            ON CONFLICT (device_id, alarm_type) DO UPDATE SET
                metric_value = EXCLUDED.metric_value,
                threshold_value = EXCLUDED.threshold_value,
                severity = EXCLUDED.severity,
                message = EXCLUDED.message,
                last_checked_at = NOW();

            INSERT INTO alarm_history (device_id, alarm_type, metric_value, threshold_value, severity, message, triggered_at, cleared_at)
            VALUES (v_dev_id, v_alarm_type, metric_val, threshold_val, severity, alarm_msg,
                    NOW() - (random() * INTERVAL '4 hours'), NULL);
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Generated simulated alarms for devices';
END $$;