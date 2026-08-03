# 同门 · 众生之厅 —— 三账号真实环境端到端测试

一套可在真实后端复现的端到端流程，用于验证 **投递闭环 / 去重 / 回信 / 封存 / 举报链路**。
脚本：`scripts/e2e_community_hall.mjs`

## 账号模型

| 账号 | 年龄段 | 角色 |
| --- | --- | --- |
| A | 23-29 | 寄信人 |
| B | 30-39 | 目标收信人 |
| C | 18-22 | 非目标对照组 |
| D | — | 临时管理员（结束时回收 admin 角色） |

三个普通账号全部通过匿名 publishable key 登录，所有断言走真实 RPC 与 RLS；
service role 客户端只用于建档、旁路核验与清理。

## 运行

```bash
bun run test:e2e:hall                      # 全量
bun run test:e2e:hall -- --only=seal,report
bun run test:e2e:hall -- --keep            # 保留合成账号便于人工复查
bun run test:e2e:hall -- --json=/tmp/hall.json
```

所需环境变量：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_PUBLISHABLE_KEY`。
退出码 0 = 全部通过，1 = 有失败，2 = 环境变量缺失。

## 覆盖的套件

| 套件 | 验证内容 |
| --- | --- |
| `identity` | 年龄段由服务端按出生日期派生；客户端无法伪造 `age_band` |
| `delivery` | A → B 投递成功；C 看不到；A 不自投；收件方看不到作者身份字段 |
| `dedupe` | 重复 dispatch 不产生重复投递；(letter, recipient) 唯一；收件匣无重复；非作者不能 dispatch |
| `reply` | 非收件人不能回信；B 回信生成回音与站内通知；重复回信被拒；回音不泄露身份 |
| `seal` | 管理员封存后收件匣与直查均不可见；恢复后可见且不产生重复投递；停用参与者；拉黑后不再匹配 |
| `report` | 举报入队为 open；非法目标类型被拒；非管理员打不开后台；后台可见举报；处置后自动 resolved；审计事件齐全 |
| `rls` | 直插信件表 / 直写审计表 / 越权读取 / 未登录读写 / 长度与年龄段校验全部被拦截 |

## 幂等与清理

- 每次运行使用 `synthetic+hall-e2e-<runId>-*` 邮箱前缀，互不冲突，可并行。
- 结束时删除本轮账号，并顺带清扫历史崩溃残留的同前缀孤儿账号。
- `--keep` 时跳过清理，请手动复查后再执行一次不带 `--keep` 的运行以回收。

## 注意

脚本会向真实数据库写入少量测试信件与审计记录（作者均为合成账号，账号删除后级联清除）。
不要在生产发布流程中自动运行；建议作为发版前的人工验收步骤。
