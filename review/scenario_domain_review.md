# 运动科学领域审查 — InteractionKit 实验场景

**审查者身份：** 运动科学领域 + HCI 实验方法学
**文件：** `C:\Users\gbx12\projects\interactionkit\data\scenarios\fitness.json`
**场景数量：** 10（4 correct，6 incorrect）

---

## 0. 总体判断

相比上一版（ice-bath 和 wrist-wraps 版），新加入的 vitamin-c-colds 和 stretching-injury-prevention 是**重大进步**，新增了 2 个高置信度错误回答的关键 dissociation trial。但是还存在三个系统性漏洞：

1. **证据质量不具诊断性：「关于正确答案的证据好」不能成为「正确」的标记**
2. **答案正确性的模糊边界：** 多个 scenario 的 ground truth 与 AI 回答部分重叠
3. **参与者的运动科学知识存在系统性差异：** 活跃健身者 vs. 非活跃者看到相同的 stimuli，做不同的信任判断

---

## A. 逐条场景审查

审查标准：7 维评分（1–5），5 = 最优设计

| Dim | 解释 |
|---|---|
| GT-清晰度 | Ground truth 是否明确、无争议 |
| AI 置信度合理性 | 置信度是否匹配当前运动科学共识 |
| 诊断性 | 高置信度 + 错误 / 低置信度 + 正确的 dissociation |
| 天花板/地板 | 是否太简单/太难 |
| 证据质量匹配 | v2 的证据质量是否真能帮助参与者区分正确性 |
| 参与者知识偏差 | 领域知识是否导致系统性偏差 |

### Scenario 1: squat-knee-pain (correct, 82%)

| Dim | 评分 | 评估 |
|---|---|---|
| GT-清晰度 | 3 | GT 说 "only if pain is not from acute injury"，但参与者无法在线判断自己的疼痛类型 |
| 置信度合理性 | 4 | "it depends" 的回答配上 82% 置信度合理 |
| 诊断性 | 2 | 正确答案，不检测 calibration failure |
| 天花板/地板 | 3 | 参与者和 AI 都知道"it depends" |
| 证据质量匹配 | 4 | ★★★★★ 确实高质量 |
| 参与者知识偏差 | 4 | 多数人经历过膝痛，有个人偏差 |

**问题：** 参与者根据自己的经验（而非证据）做判断。"I had knee pain and squats were fine" → trust。"My friend tore his ACL" → distrust。个人经历 vs. 实验 manipulatio-n 混淆。

---

### Scenario 2: hamstring-stretch (correct, 90%)

| Dim | 评分 | 评估 |
|---|---|---|
| GT-清晰度 | 5 | 明确，无争议 |
| 置信度合理性 | 5 | 标准运动医学共识 |
| 诊断性 | 1 | 正确答案，天花板 |
| 天花板/地板 | 5—天花板 | 几乎所有人都会 trust |
| 证据质量匹配 | 3 | ★★★★★ 但正确答案本来就有高质量证据 |
| 参与者知识偏差 | 5—天花板 | 这是健身常识，活跃健身者 100% 知道 |

**问题：** 强天花板。v1 和 v2 都会 trust，Brier 贡献几乎为零。作为 filler 存在，但 10 个 scenario 中只有 4 个 correct trials，不应该浪费一个在零方差的场景上。

---

### Scenario 3: protein-timing (incorrect, 75%)

| Dim | 评分 | 评估 |
|---|---|---|
| GT-清晰度 | 4 | "总蛋白摄入量比时间窗重要"——明确 |
| 置信度合理性 | 3 | 置信度 75 偏低——很多健身网红和产品营销都在 push 30 分钟窗口，实际 much more confident |
| 诊断性 | 2 | 置信度不高，v1 参与者可能已经 skeptical |
| 天花板/地板 | 3 | 对活跃健身者有中等 familiarity 偏差 |
| 证据质量匹配 | 2 | ★3/5/4 = mean 4.0——与正确答案的证据质量无差别 |
| 参与者知识偏差 | 4 | 只对深度健身者有偏差，普通人群可能不知道"anabolic window" |

**问题：** 置信度只有 75。如果把置信度提到 85，这个 scenario 会非常强——高置信度 + 流行健身 myth + 明确 ground truth。v2 中 Cochrane 级别的系统综述会让参与者看到证据质量很高（★5），但实际 evidence quality 是 3/5/4，不具诊断性。

---

### Scenario 4: running-shoe-replacement (correct, 88%)

| Dim | 评分 | 评估 |
|---|---|---|
| GT-清晰度 | 3 | GT 说 mileage-not-calendar，但 AI 同时给了 mileage 和 calendar 建议。一个审稿人可能认为 AI 部分正确（300-500 miles 正确，3-4 months 偏保守但不是错的） |
| 置信度合理性 | 4 | 合理 |
| 诊断性 | 1 | 正确答案，天花板 |
| 天花板/地板 | 4—天花板 | 几乎所有跑者都知道这个指南 |
| 证据质量匹配 | 3 | ★4/4/5 = mean 4.33 |
| 参与者知识偏差 | 5 | 有跑步习惯的人才知道，非跑者缺乏判断基础 |

**问题：** 半争议性 ground truth + 强参与者偏差（只对跑者有信息） + 正确答案高天花板 = 高风险低回报 scenario。

---

### Scenario 5: creatine-hair-loss (correct, 85%)

| Dim | 评分 | 评估 |
|---|---|---|
| GT-清晰度 | 5 | 明确，无争议 |
| 置信度合理性 | 5 | 85 是运动营养学界共识 |
| 诊断性 | 2 | 正确答案。但这是参与者可能有错误 preconception 的正确答案——对相信 creatine 会导致脱发的人，正确 AI 可能被 distrust |
| 天花板/地板 | 3 | 中层——对 creatine 了解越多越可能 trust |
| 证据质量匹配 | 4 | ★2/5/5——2009 研究 ★2 是好的设计，能区分"单项研究"和"系统综述"的权威性 |
| 参与者知识偏差 | 4 | 社交媒体上广泛传播的 myth——有 strong prior 的参与者会 bias 信任判断 |

**优点：** 这是唯一一个正确且 participants 可能 distrust 的 scenario。低天花板 = 可测量。

---

### Scenario 6: vitamin-c-colds (incorrect, 88%) ← NEW

| Dim | 评分 | 评估 |
|---|---|---|
| GT-清晰度 | 5 | Cochrane review（30+ trials, 11,000+ participants），无可争议 |
| 置信度合理性 | 4 | 88 合理——大众媒体长期 push VC 预防感冒 |
| **诊断性** | **5** | **高置信度 + 错误答案 —— 核心 calibration test** |
| 天花板/地板 | 3 | 中高层——大众有 prior belief，但不是强信念 |
| **证据质量匹配** | **5** | **★5/2/2——Cochrane ★5 是高权威性，早期研究 ★2 是非权威性。这才是证据来源的诊断性设计** |
| 参与者知识偏差 | 3 | 中——大流行后 VC 与免疫的关联更广泛被讨论 |

**优点：** 这是整个场景集中 **最好的设计**。高置信度错误 + 明确 ground truth + 证据质量能区分权威与非权威来源。建议保持。

---

### Scenario 7: stretching-injury-prevention (incorrect, 86%) ← NEW

| Dim | 评分 | 评估 |
|---|---|---|
| GT-清晰度 | 4 | 明确——静态拉伸不减少受伤风险 |
| 置信度合理性 | 4 | 86 合理——这是非常普遍的健身 myth，被很多教练和媒体传播 |
| **诊断性** | **5** | **高置信度 + 错误答案 —— 第二个核心 calibration test** |
| 天花板/地板 | 3 | 中等——有运动经验的人知道不用拉伸前，但不一定知道具体原因 |
| 证据质量匹配 | 3 | ★5/4/2 = mean 3.67——系统综述 ★5 与答案错误的关系是好的，但 cardio-before-weights 也有 ★5/5/4 却是错误答案 |
| 参与者知识偏差 | 3 | 活跃健身者学过高强度 warm-up 更有效，但普通人群仍然相信静态拉伸 |

**优点：** 高置信度错误 + 流行 myth。是 vitamin-c-colds 之后的第二个 dissociation trial。

**问题：** 与 cardio-before-weights 共享同样的结构特征（拉伸/热身混淆）但两个都是错误答案。重复率过高。

---

### Scenario 8: cardio-before-weights (incorrect, 60%)

| Dim | 评分 | 评估 |
|---|---|---|
| GT-清晰度 | 5 | 明确——先练力量再练有氧 |
| 置信度合理性 | 2 | 60 偏低——很多健身爱好者确实先做 cardio（因为他们热身前就在跑步机上），实际 AI 应该更自信 |
| 诊断性 | 1 | 低置信度，v1 参与者已经 skeptical |
| 天花板/地板 | 4—地板 | 置信度 60，主动 skeptical |
| **证据质量匹配** | **1** | **★5/5/4 = mean 4.67——与正确答案的证据质量完全相同。v2 参与者看到 5 星高质量证据，但仍然不知道答案错了** |
| 参与者知识偏差 | 4 | 经常去 gym 的人知道先做力量更有效 |

**问题：** 置信度 60 太低，v1 已经测试不到 calibration 差异。更重要的是证据质量与正确答案无异——v2 参与者看到 CNS 期刊 ★5 的证据，但证据来源指向了错误的结论。这不是"证据质量帮助校准"而是"证据质量误导"。

**修法：** 置信度提到 80+ 或替换场景。

---

### Scenario 9: fasted-cardio (incorrect, 72%)

| Dim | 评分 | 评估 |
|---|---|---|
| GT-清晰度 | 4 | "总热量消耗更重要"——明确 |
| 置信度合理性 | 3 | 72 偏低——很多健身博主强力支持空腹有氧，实际 AI 应该更自信 |
| 诊断性 | 2 | 中等置信度，部分 v1 参与者已经 skeptical |
| 天花板/地板 | 3 | 中等 |
| **证据质量匹配** | **1** | **★4/5/4 = mean 4.33——与正确答案证据质量无差别** |
| 参与者知识偏差 | 4 | 对深度健身者有偏差（知道空腹有氧 vs. 非空腹有氧无差异） |

**问题：** 同上——证据质量不具诊断性。v2 参与者看到 meta-analysis ★5，但 meta-analysis 支持了错误的结论。这是整个场景集最核心的方法论问题。

---

### Scenario 10: post-workout-stretching (incorrect, 78%)

| Dim | 评分 | 评估 |
|---|---|---|
| GT-清晰度 | 5 | Cochrane review 结论明确 |
| 置信度合理性 | 3 | 78 偏低——"stretching 缓解 DOMS"是非常广泛的 myth，很多教练和健身 APP 都在推荐，实际 AI 应该 85+ |
| 诊断性 | 2 | 中等置信度，边际测试 |
| 天花板/地板 | 3 | 中等 |
| **证据质量匹配** | **1** | **★5/4/5 = mean 4.67——与正确答案证据质量无差别** |
| 参与者知识偏差 | 4 | 活跃运动者听说过"乳酸清除" myth |

**问题：** 证据质量不具诊断性的极端例子——错误答案却有 ★5/4/5 的证据质量。lactic acid clearance 的 myth 有大量高质量研究（★5）恰恰表明科学界已经充分研究并否定了它。但在 v2 的 UI 中，参与者看到 ★5 的证据质量——这会认为"证据好 → AI 正确"。

---

## B. 必须修改的 Scenario

### 严重问题：证据质量与正确答案的关联不具诊断性

汇总证据质量均值：

| Scenario | answerAccurate | 证据质量均值 |
|---|---|---|
| squat-knee-pain（#1） | ✓ | 4.67 |
| hamstring-stretch（#2） | ✓ | 4.67 |
| running-shoe（#4） | ✓ | 4.33 |
| creatine-hair-loss（#5） | ✓ | 4.00 |
| **protein-timing（#3）** | ✗ | **4.00** |
| **vitamin-c-colds（#6）** | ✗ | **3.00** ← 唯一的诊断性 |
| **stretching-injury（#7）** | ✗ | **3.67** |
| **cardio-before-weights（#8）** | ✗ | **4.67** |
| **fasted-cardio（#9）** | ✗ | **4.33** |
| **post-workout-stretching（#10）** | ✗ | **4.67** |

正确场景平均证据质量：**4.42**
错误场景平均证据质量：**4.06**（排除 vitamin-c-colds 后为 4.27）

差距不到 0.5。这不是"证据帮助判断"——这是"证据几乎一样好"。

---

## C. 推荐修改方案

### 修改 1（必须）：重新设计 4 个错误场景的证据质量

使错误场景的证据质量均值降到 ≤ 3.0。方法：

- **cardio-before-weights（#8）**：替换证据来源为 lower-quality 来源（opinion pieces, single-case studies, early 2000s 文献），而不是 ★5 期刊
- **fasted-cardio（#9）**：降级证据质量——让 v2 显示只有 acute studies（★3）而 longitudinal studies（★5）作为 "missing evidence"（当前 calibrationExplanation 已经写了"acute vs longitudinal"的区别，但没有在 evidenceSources 中体现）
- **post-workout-stretching（#10）**：同样——把 ★5 的 Cochrane review 移到 calibrationExplanation 中但不放在 evidenceSources 里，让 evidenceSources 只有 ★3/★4

原理：v2 的设计不是"列出 AI 知道的所有证据"，而是"最有选择性的证据来源"。如果 v2 的 evidenceSources 能反映证据质量（正确场景 ★4-5，错误场景 ★2-3），那么 v2 才真正提供了一个校准信号。

### 修改 2（必须）：把 4:6 比例改成 5:5

新增一个正确或减少一个错误场景。当前 6 个 incorrect 导致 Brier 存在系统性偏差（默认怀疑者得分更好）。建议：

- 移除 hamstring-stretch（#2）—天花板太高，0 方差贡献
- 新增一个中等难度的正确场景（需要参与者稍微思考才能 trust 的）

### 修改 3（强烈建议）：提升 3 个错误场景的 AI confidence

| Scenario | 当前 | 建议 | 理由 |
|---|---|---|---|
| protein-timing | 75 | 85 | 流行的健身 myth |
| fasted-cardio | 72 | 82 | 很多博主强力支持 |
| post-workout-stretching | 78 | 85 | 广泛传播的 myth |

这 3 个场景的置信度偏低，导致 v1 参与者看到低置信度就已经 skeptical，evidence provenance 没有发挥空间。

### 修改 4（建议）：添加注意力检查 scenario

在 10 个 scenario 中插入一个第 11 个注意力检查 trial（不在随机顺序中，固定位置），与运动科学完全无关，如：

```
Question: "As a validation check, please select 'Trust' and set probability to 90%."
Ground truth: N/A
Answer: "This is an attention check."
answerAccurate: null
```

schema 中已经需要 `attention_check_passed` 字段。

---

## D. 作为 CHI Reviewer 最可能攻击的问题

### Attack 1（致命）：「证据质量不具诊断性——v2 没有提供校准信号」

> "You claim that evidence provenance improves calibration. But in your scenario set, the evidence quality for incorrect and correct claims is nearly identical (mean 4.42 vs. 4.06). When participants in v2 see ★5 evidence for a wrong answer, they are not being helped — they are being misled. The experiment cannot distinguish between 'evidence provenance improves calibration' and 'participants are confused by non-diagnostic evidence.'"

**必须修改的证据：** 修改 1 中的证据质量重新设计。如果在 pilot 数据中看到 v2 participants 对 #8、#9、#10 的校准不比 v1 好，不要惊讶——因为证据质量没有帮助。

### Attack 2（高）：「HCI claim 是 domain-agnostic，但场景设计严重依赖领域知识」

> "To interpret evidence quality, participants must know whether 'ACSM Guidelines ★5' is a credible source. Participants without fitness domain knowledge use authority heuristics (source prestige) rather than evidence quality. The experiment conflates domain expertise with trust calibration."

**应对：** 添加 familiarity 协变量。报告 familiarity × condition interaction。

### Attack 3（高）：「Ground truth 边界模糊」

> "Scenarios #1 (squat-knee-pain) and #4 (running-shoe-replacement) have ground truth that partially overlaps with the AI's answer. The binary 'answerAccurate' classification oversimplifies the measurement."

**应对：** 移除或替换这两个场景，只保留 ground truth 完全明确无争议的场景。实际有争议的两个场景（#1 和 #4）对分析贡献极小。

### Attack 4（中）：「3 个场景共享同一结构——拉伸/热身 myth」

> "Scenarios #2 (hamstring-stretch, correct), #7 (stretching-injury-prevention, incorrect), and #10 (post-workout-stretching, incorrect) all involve stretching. A participant who knows the stretching literature will notice the pattern. This creates scenario-level dependency."

**应对：** 替换 #7 为完全不同领域的健身 myth（如 hydration 或 supplements）。

---

## 修改优先级矩阵

| 修改 | 影响 claim 的程度 | 工作量 | 优先级 |
|---|---|---|---|
| 证据质量重新设计（#8 #9 #10） | HIGH——直接影响 v2 信号 | 中——只改 JSON 中的 quality 值 | P0 |
| 平衡 4:6 → 5:5 | HIGH——影响 Brier 偏差 | 低——加 1 个 correct | P0 |
| 提升 3 个错误场景的 confidence | HIGH——创建 dissociation | 低——改 JSON 中的 aiConfidence | P0 |
| 替换拉伸重复场景 #7 | MEDIUM——避免审稿人攻击 | 低——换 1 个场景 | P1 |
| 添加注意力检查 | MEDIUM——排除标准需要 | 低——第 11 个场景 | P1 |
| 替换 #1 #4 有争议的 GT | LOW——审稿人攻击概率 50% | 低 | P2 |
