-- The admin uploads placement images straight to storage with a signed URL
-- (a server action would hit Next's 1 MB body limit). The browser declares
-- the size it sends, so the bucket enforces the real limits itself.
update storage.buckets
   set file_size_limit = 3145728, -- 3 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
 where id = 'discover-placements';
