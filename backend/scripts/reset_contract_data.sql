-- 重新部署 NFT 合约后，刷新链下市场数据。
-- 只在确认过的本地库或演示库执行。
--
-- 会清空：
--   orders：旧 NFT 和旧交易哈希对应的订单记录
--   nfts：旧合约地址和旧 tokenId 对应的 NFT 镜像记录
--
-- 会保留：
--   users：钱包登录用户、头像、nonce
--
-- 如果你想连用户也一起清空：
--   1. 先退出前端登录，或清空浏览器 localStorage/sessionStorage。
--   2. 再把脚本末尾的 TRUNCATE TABLE users 取消注释。
--   3. 执行后需要重新连接钱包、重新签名登录。
--
-- 使用方式：
--   1. 把 @expected_database 改成你当前要刷新的数据库名。
--   2. 在 MySQL 里执行本脚本。
--   3. 更新 backend/.env 的 ACTIVE_NFT_CONTRACT 和 frontend/.env.local。
--   4. 重启后端和前端，然后在新合约上重新创建 NFT。

SET @expected_database = 'nft';
SET @current_database = DATABASE();

SELECT
  CASE
    WHEN @current_database = @expected_database THEN 'OK: database confirmed'
    ELSE CONCAT(
      'ERROR: connected to ',
      COALESCE(@current_database, '<none>'),
      ', expected ',
      @expected_database
    )
  END AS reset_check;

SET @database_mismatch = @current_database <> @expected_database;
SET @stop_on_mismatch = IF(
  @database_mismatch,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''Refusing to reset unexpected database''',
  'SELECT ''Resetting chain-bound tables'' AS reset_status'
);

PREPARE reset_guard FROM @stop_on_mismatch;
EXECUTE reset_guard;
DEALLOCATE PREPARE reset_guard;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE orders;
TRUNCATE TABLE nfts;
-- TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'DONE: orders and nfts have been reset; users were kept' AS reset_result;
