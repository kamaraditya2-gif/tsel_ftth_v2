-- Generate test data with 32 hops for traceroute
-- Update a random record in queue_results with 32 hops

-- First, get a random record ID
SELECT id FROM queue_results WHERE traceroute_hops IS NOT NULL ORDER BY RANDOM() LIMIT 1;

-- Update a specific record with 32 hops (replace with actual ID from above)
-- For this example, let's use ID 1 if it exists, or find another
UPDATE queue_results 
SET traceroute_hops = '{"hop":1,"ip":"192.168.1.1","time":"2ms"},{"hop":2,"ip":"10.0.0.1","time":"5ms"},{"hop":3,"ip":"192.168.1.2","time":"8ms"},{"hop":4,"ip":"10.0.0.2","time":"12ms"},{"hop":5,"ip":"192.168.1.3","time":"15ms"},{"hop":6,"ip":"10.0.0.3","time":"18ms"},{"hop":7,"ip":"192.168.1.4","time":"22ms"},{"hop":8,"ip":"10.0.0.4","time":"25ms"},{"hop":9,"ip":"192.168.1.5","time":"28ms"},{"hop":10,"ip":"10.0.0.5","time":"31ms"},{"hop":11,"ip":"192.168.1.6","time":"35ms"},{"hop":12,"ip":"10.0.0.6","time":"38ms"},{"hop":13,"ip":"192.168.1.7","time":"42ms"},{"hop":14,"ip":"10.0.0.7","time":"45ms"},{"hop":15,"ip":"192.168.1.8","time":"48ms"},{"hop":16,"ip":"10.0.0.8","time":"52ms"},{"hop":17,"ip":"192.168.1.9","time":"55ms"},{"hop":18,"ip":"10.0.0.9","time":"58ms"},{"hop":19,"ip":"192.168.1.10","time":"62ms"},{"hop":20,"ip":"10.0.0.10","time":"65ms"},{"hop":21,"ip":"192.168.1.11","time":"68ms"},{"hop":22,"ip":"10.0.0.11","time":"72ms"},{"hop":23,"ip":"192.168.1.12","time":"75ms"},{"hop":24,"ip":"10.0.0.12","time":"78ms"},{"hop":25,"ip":"192.168.1.13","time":"82ms"},{"hop":26,"ip":"10.0.0.13","time":"85ms"},{"hop":27,"ip":"192.168.1.14","time":"88ms"},{"hop":28,"ip":"10.0.0.14","time":"92ms"},{"hop":29,"ip":"192.168.1.15","time":"95ms"},{"hop":30,"ip":"10.0.0.15","time":"98ms"},{"hop":31,"ip":"192.168.1.16","time":"102ms"},{"hop":32,"ip":"10.0.0.16","time":"105ms"}'
WHERE id = (SELECT id FROM queue_results WHERE traceroute_hops IS NOT NULL ORDER BY RANDOM() LIMIT 1);

-- Verify the update
SELECT id, 
       LENGTH(traceroute_hops) as data_length,
       SUBSTRING(traceroute_hops, 1, 100) as preview
FROM queue_results 
WHERE traceroute_hops LIKE '%hop":32%'
ORDER BY id DESC 
LIMIT 1;
