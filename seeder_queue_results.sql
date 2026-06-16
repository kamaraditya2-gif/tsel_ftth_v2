-- Seeder untuk 2000 data queue_results
-- Pastikan tabel devices dan queue_jobs sudah memiliki data sebelum menjalankan script ini

DO $$
DECLARE
    i INTEGER;
    device_count INTEGER;
    job_count INTEGER;
    random_device_id INTEGER;
    random_job_id UUID;
    random_ping FLOAT;
    random_download FLOAT;
    random_upload FLOAT;
    random_packet_loss FLOAT;
    random_executed_at TIMESTAMP;
    start_time TIMESTAMP := NOW() - INTERVAL '7 days';
    end_time TIMESTAMP := NOW();
    random_interval INTERVAL;
BEGIN
    -- Cek jumlah data di devices dan queue_jobs
    SELECT COUNT(*) INTO device_count FROM devices;
    SELECT COUNT(*) INTO job_count FROM queue_jobs;
    
    IF device_count = 0 THEN
        RAISE NOTICE 'Tabel devices kosong. Silakan isi data devices terlebih dahulu.';
        RETURN;
    END IF;
    
    IF job_count = 0 THEN
        RAISE NOTICE 'Tabel queue_jobs kosong. Silakan isi data queue_jobs terlebih dahulu.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Memulai seeder untuk 2000 data queue_results...';
    RAISE NOTICE 'Jumlah devices: %', device_count;
    RAISE NOTICE 'Jumlah queue_jobs: %', job_count;
    
    -- Loop untuk 2000 data
    FOR i IN 1..2000 LOOP
        -- Random device_id dari devices
        EXECUTE format('SELECT id FROM devices ORDER BY RANDOM() LIMIT 1') INTO random_device_id;
        
        -- Random queue_job_id dari queue_jobs
        EXECUTE format('SELECT id FROM queue_jobs ORDER BY RANDOM() LIMIT 1') INTO random_job_id;
        
        -- Random ping_ms (0-500ms)
        random_ping := (random() * 500);
        
        -- Random download_speed (0-150 Mbps)
        random_download := (random() * 150);
        
        -- Random upload_speed (0-100 Mbps)
        random_upload := (random() * 100);
        
        -- Random packet_loss (0-25%)
        random_packet_loss := (random() * 25);
        
        -- Random executed_at dari 1 minggu lalu sampai sekarang
        random_interval := (random() * (end_time - start_time));
        random_executed_at := start_time + random_interval;
        
        -- Insert data
        INSERT INTO queue_results (
            queue_job_id,
            device_id,
            ping_ms,
            download_speed,
            upload_speed,
            packet_loss,
            success,
            executed_at
        ) VALUES (
            random_job_id,
            random_device_id,
            random_ping,
            random_download,
            random_upload,
            random_packet_loss,
            true,
            random_executed_at
        );
        
        -- Progress setiap 500 data
        IF i % 500 = 0 THEN
            RAISE NOTICE 'Progress: %/2000 data diinsert', i;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Seeder selesai! 2000 data queue_results berhasil diinsert.';
END $$;

-- Verifikasi hasil
SELECT COUNT(*) as total_queue_results FROM queue_results;
