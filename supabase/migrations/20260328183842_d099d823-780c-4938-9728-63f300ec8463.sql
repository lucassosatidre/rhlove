
DROP POLICY IF EXISTS "Users can update demands" ON demands;

CREATE POLICY "Users can update demands" ON demands
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  OR auth.uid() = assigned_to
  OR is_admin(auth.uid())
);
