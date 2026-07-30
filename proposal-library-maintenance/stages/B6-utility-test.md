# B6：用真实项目检验方法库效用

## 为什么 B6 不等于 Contract 校验

Schema 通过只能证明数据能被机器读取，不能证明 Wiki 对写方案有帮助。B6 用真实 brief 检查新增方法是否提高洞察覆盖和表达组织，或反而造成锚定、套模板与虚构。

## 测试一：洞察与方法覆盖

1. 不看 Wiki，先独立阅读真实 brief，记录项目问题、初始洞察和需要的方法。
2. 再读取安装后的 Wiki，记录它补充、挑战、细化或没有改变的地方。
3. 对每个 delta 写明来自哪个 Lens/Recipe，区分“真正新增判断”与“只是换了说法”。
4. 记录遗漏、错误命中、检索失败、旧库锚定和强行套方法。

这一步不做 Deck 级页面产出，核心是检查 Recipe/Lens 是否给写方案提供了更好的参考。

## 测试二：页面表达组织

固定同一组已经批准的主张和证据，分别在无 Wiki 与有 Wiki 条件下组织页面。只比较页面角色、信息关系、前后推进和证据需求；不能让有 Wiki 版本偷偷增加新事实。判断页面结构是否提供帮助，还是变成僵硬模板。

## 输出

输出 `utility-test/1.0.0`，明确 `tested` 或 `pending_input`，并记录 anchoring、template_lock_in、fabricated_claim、coverage_gap、retrieval_failure 风险。

```bash
node scripts/validate-utility-test.mjs <运行目录>/B6/utility-test.json
```

没有真实 brief 时可以完成安装，但 B6 只能记录 `pending_input`，不能写“已经验证有效”。发现的问题应归因到 B2/B3a/B3b/B3c/B3d/B4/检索中的具体阶段，供后续 Memory Audit 使用。
