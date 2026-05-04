-- 本文件用于重新部署 NFT 合约后，清空和旧合约绑定的链下市场数据。
-- 只建议在你确认过的本地数据库或演示数据库执行，不要直接对生产库执行。
--
-- 会清空：
--   orders：旧 NFT 和旧交易哈希对应的订单记录。
--   nfts：旧合约地址和旧 tokenId 对应的 NFT 镜像记录。
--
-- 会保留：
--   users：钱包登录用户、头像、nonce 等用户数据。
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

-- expected_database 是防误删保护：只有当前连接的数据库名等于它时才会继续执行。
SET @expected_database = 'nft';

-- current_database 是当前 MySQL 会话选中的数据库名。
SET @current_database = DATABASE();

-- reset_check 会显示当前数据库是否符合预期，方便执行前肉眼确认。
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

-- database_mismatch 表示当前库名和预期库名是否不一致。
SET @database_mismatch = @current_database <> @expected_database;

-- stop_on_mismatch 在库名不一致时动态生成 SIGNAL，让脚本直接报错停止。
SET @stop_on_mismatch = IF(
  @database_mismatch,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''Refusing to reset unexpected database''',
  'SELECT ''Resetting chain-bound tables'' AS reset_status'
);

-- reset_guard 是动态 SQL 保护语句，执行后才允许进入真正的清表步骤。
PREPARE reset_guard FROM @stop_on_mismatch;
EXECUTE reset_guard;
DEALLOCATE PREPARE reset_guard;

-- 清表前临时关闭外键检查，避免 orders 引用 nfts 时阻止 TRUNCATE。
SET FOREIGN_KEY_CHECKS = 0;

-- orders 保存成交历史，旧合约重部署后这些记录对应旧 token，不应继续展示。
TRUNCATE TABLE orders;

-- nfts 保存链下 NFT 镜像，旧合约重部署后 tokenId/contract 都应该重新生成。
TRUNCATE TABLE nfts;

-- users 默认保留；如果要完全重置登录用户，可以手动取消下一行注释。
-- TRUNCATE TABLE users;

-- 清表完成后恢复外键检查。
SET FOREIGN_KEY_CHECKS = 1;

-- reset_result 是脚本执行完成后的确认信息。
SELECT 'DONE: orders and nfts have been reset; users were kept' AS reset_result;
