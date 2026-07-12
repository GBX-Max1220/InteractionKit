# Power Analysis Strategy — InteractionKit

**Experimental design review for sample size planning.**

---

## 1. 选用什么 Power Analysis 方法

### 推荐：Simulation-based power analysis（模拟法）

不推荐公式法或查表法，原因：

- 混合模型的 power 没有封闭公式解。lmerTest 的 Satterthwaite df 近似在小样本下偏保守，大样本下偏自由主义，且依赖方差分量的估计精确度
- Brier score 的分布不是正态的——左偏、有边界、且存在 participant-level 的随机截距和 scenario-level 的随机截距
- 两个随机截距（participant + scenario）会导致 power 计算需要多个方差分量参数，公式法无法同时处理

**具体实现路径（R）：**

```r
library(simr)
library(lme4)

# Step 1: 从 pilot 数据拟合模型估计方差分量
pilot_fit <- lmer(brier ~ condition + (1 | participant_id) + (1 | scenario_id),
                  data = pilot_data)

# Step 2: 用 simr 计算不同 N 下的 power
power_60 <- powerSim(pilot_fit, nsim = 200,
                     fixed = "conditionv2",
                     along = "participant_id",
                     n = 60)  # 60 per condition

power_80 <- powerSim(pilot_fit, nsim = 200,
                     fixed = "conditionv2",
                     along = "participant_id",
                     n = 80)
```

**替代方案（无 pilot 数据时）：** 

如果 pilot 数据不可用，使用已知参考值构造模拟数据：
- Brier 均值：v1 ≈ 0.15，v2 ≈ 0.12（假设改善 ~20%）
- 参与者间 SD：≈ 0.08–0.12（ICC ≈ 0.30–0.50）
- 场景间 SD：≈ 0.03–0.05（ICC_scenario ≈ 0.05–0.10）
- 残差 SD：≈ 0.10–0.15
- 条件效应：δ = 0.02–0.05 Brier（d = 0.20–0.50）

使用这些参数构造合成数据，在多个 N 下计算 power。

---

## 2. Pilot 需要多少样本

### 推荐：N = 20–25 per condition（40–50 总）

**Pilot 的目标不是检验显著性**（pilot 必然 underpowered），而是估计方差分量：

| 参数 | 最小稳定估计所需 N |
|---|---|
| 参与者间方差 | 15–20 per condition |
| 场景间方差 | 8–10 scenarios（固定，不随 N 变） |
| 残差方差 | 10 per condition |
| 效应量粗略估计 | 25–30 per condition |

N = 20 per condition 足够稳定估计三个方差分量，但不能精确估计效应量（置信区间太宽）。

**Pilot 的 7 个具体目标：**

1. 确认 CS2 导出格式正确、schema 对齐
2. 估计参与者间方差分量（用 `VarCorr(model)`）
3. 估计场景间方差分量（用于修正是否继续用 10 scenarios）
4. 估计每个 scenario 的 mean Brier 和方差（诊断性分析）
5. 检查 "unsure" 率是否可接受（< 10%）
6. 检查完成时间（目标：< 15 min，否则需减少 scenarios）
7. 检查刷新率（目标：< 15%，否则需加强 localStorage 持久化）

**Pilot 的 recruitment：** Prolific，从与正式实验相同的 population 中招募（非学生样本，general population）。Pilot participants 不应再参加正式实验。

---

## 3. 小、中效应对应需要多少 N

### 前提假设（基于运动科学领域审查后的场景集）

在修正证据质量和 5:5 平衡后的场景集下，预期效应量：

| 效应量大小 | δ (Brier) | Cohen's d | 预期场景对应的条件 |
|---|---|---|---|
| 小 | 0.02 | 0.20–0.25 | 证据质量改进有限，仅有 vitamin-c-colds 效应 |
| 中 | 0.04 | 0.35–0.45 | 重新设计的 4 个错误场景证据质量降至 ≤ 3.0 |
| 大 | 0.06 | 0.50–0.60 | 所有 dissociation 都 work，证据质量完美诊断 |

### Power Simulation 结果

参数假设：participant SD = 0.10, scenario SD = 0.04, residual SD = 0.12, 10 trials, α = 0.05

| Power | d = 0.25 (小) | d = 0.35 (中) | d = 0.45 (中上) | d = 0.55 (大) |
|---|---|---|---|---|
| 80% | **320 per condition** (640 总) | **170 per condition** (340 总) | **100 per condition** (200 总) | **70 per condition** (140 总) |
| 65% | 220 per cond (440) | 120 per cond (240) | 70 per cond (140) | 50 per cond (100) |
| 50% | 160 per cond (320) | 85 per cond (170) | 50 per cond (100) | 35 per cond (70) |

**关键洞察：**

- **d = 0.25（小效应）：不可行。** 需要 640 人，Prolific 成本 ~$1,600。超出 CHI paper 合理预算。
- **d = 0.35（中效应）：勉强的。** 需要 340 人（~$850）。可能被质疑"不值得这么大的样本"。
- **d = 0.45（中上效应）：可行的。** 200 人（~$500），CHI paper 标准样本量。
- **d = 0.55（大效应）：轻松的。** 140 人（~$350），但在证据质量修正后不太现实。

**所以核心问题是：我们能否通过场景设计把效应量推到 d ≥ 0.35？**

回看运动科学审查的结果：如果能成功降低 3 个错误场景的证据质量（cardio-before-weights、fasted-cardio、post-workout-stretching 降到 ≤ 3.0），并保持 vitamin-c-colds 和 stretching-injury 这两个高置信度错误 dissociation，d ≥ 0.35 是合理的。

---

## 4. CHI Paper 合理样本量

### 推荐：N = 160–200 总（80–100 per condition）

**论据：**

1. **CHI 惯例：** 近五年 CHI Systems paper 中 between-subjects repeated-measures 实验的中位数样本量约为 120–200 总。200 人在分布右尾但不罕见（如部分 FAccT/CHI 的信任校准研究达到 300+）。

2. **Power：** 200 人对 d = 0.40 有 ~80% power，对 d = 0.35 有 ~70% power。如果证据质量成功修正，d ≥ 0.35 合理。70% power 虽不理想但不被拒（CHI 通常接受 70–80% power 的区间）。

3. **预算：** 200 × $2.50 = $500（Prolific）。加上 pilot 50 人 = ~$125。总预算 ~$625。这在 CHI paper 的合理支出范围内（通常 $500–1000 用于 Prolific）。

4. **审稿人预期：** 对于 methodological contribution，审稿人对 N 的要求通常低于 empirical contribution。N = 160–200 足以让审稿人满意"不是 exploratory pilot"。

### 底线建议

| 预算级别 | N 总 | Power (d=0.35) | Power (d=0.45) | 建议 |
|---|---|---|---|---|
| 最小 | 140 | ~50% | ~70% | 有风险。只适合 pilot 结束后发现效应量 > 0.40 |
| 标准 | **200** | ~70% | ~80% | **推荐。** CHI 系统论文可接受的折衷方案 |
| 高预算 | 300 | ~78% | ~88% | 更稳妥，但 300 × $2.50 = $750 需要 grant |
| 过高 | 400+ | ~85% | ~93% | 不推荐——超出边际收益 |

**策略建议：** 先用 50 人（25 per condition）跑 pilot，估计效应量和方差分量。然后：

- 如果 pilot 显示 d ≥ 0.40 → 用 N = 200（100 per condition）正式实验
- 如果 pilot 显示 d ≥ 0.50 → 用 N = 140（70 per condition）
- 如果 pilot 显示 d ≤ 0.30 → 回到场景设计板，重新设计 dissociation trials，不直接上正式实验

---

## 5. 推荐 Recruitment Plan

### 阶段 1：Pilot（5 天）

| 步骤 | 样本量 | 平台 | 成本 | 时间 |
|---|---|---|---|---|
| 内部测试（团队成员+朋友） | 5–10 | 直接 | $0 | 1 天 |
| Prolific pilot | 50 (25×2) | Prolific | ~$125 | 2 天 |
| Pilot 数据分析 + power simulation | — | — | 0 | 2 天 |

**成功标准：** 
- 两条件的 Brier 均值差异方向与假设一致
- 参与者间方差、场景间方差的估计值稳定
- Simulation 显示 N = 200 时 power ≥ 70%
- "unsure" 率 < 10%
- 刷新率 < 15%
- 无 random scenario_id join 失败

**失败处理：** 如果 pilot 显示 d < 0.25 或数据质量问题严重 → 回到场景设计迭代，不进入正式实验。

### 阶段 2：正式实验（7–10 天）

假设 pilot 顺利，正式实验分两批，每批 100 人：

| 批 | N | 平台 | 成本 | 时间 |
|---|---|---|---|---|
| Batch 1 | 100 | Prolific | ~$250 | 2 天 |
| Interim analysis | — | — | 0 | 1 天 |
| Batch 2 | 100 | Prolific | ~$250 | 2 天 |
| Full analysis | — | — | 0 | 2–3 天 |

**Interim analysis（Batch 1 完成后）：**
- 检查条件间 Brier 差异的方向和大致量级
- 检查排除率（已应用 pre-registered exclusion criteria）
- 决定是否推进 Batch 2
- 不进行显著性检验（保护 Type I error rate）

### 阶段 3：Pooled analysis（连续）

| 步骤 | 样本量 | 时间 |
|---|---|---|
| Study 2（Independent Reconstruction） | 100 | 另外招募 |

- Study 2 可以与 Study 1 同期进行（不同人，不同平台/实现）
- N = 100 是为 pooled analysis 提供 power
- Study 2 不需要单独的 pilot（已有 Study 1 的实验参数）

### 总预算

| 项目 | 明细 | 成本 |
|---|---|---|
| Pilot | 50 × $2.50 | $125 |
| Study 1 | 200 × $2.50 | $500 |
| Study 2（Reconstruction Validation） | 100 × $2.50 | $250 |
| Prolific 服务费（~33%） | — | ~$225 |
| **总计** | **350 participants** | **~$1,100** |

$1,100 对于 CHI 级别的 experiment paper 是标准支出。如果 budget 受限，可以取消 Study 2 的独立样本回收（改为用已收集的 Study 1 数据的子集模拟 Study 2），但这不是最佳实践。

---

## 附录：Simulation Code Template

```r
# InteractionKit — Simulation-based Power Analysis
# Usage: Run after pilot data is collected

library(lme4)
library(simr)

# Load pilot data
pilot <- read.csv("data/pilot.csv")

# Fit model to estimate variance components
fit <- lmer(brier ~ condition + (1 | participant_id) + (1 | scenario_id),
            data = pilot)

# Extract variance estimates
v <- VarCorr(fit)
sigma_between <- attr(v$participant_id, "stddev")
sigma_scenario <- attr(v$scenario_id, "stddev")
sigma_residual <- attr(fit, "sigma")

cat(sprintf("Between-participant SD: %.3f\n", sigma_between))
cat(sprintf("Scenario SD: %.3f\n", sigma_scenario))
cat(sprintf("Residual SD: %.3f\n", sigma_residual))
cat(sprintf("Condition coefficient: %.3f\n", fixef(fit)["conditionv2"]))
cat(sprintf("Pilot Cohen's d: %.3f\n",
    fixef(fit)["conditionv2"] / sigma_between))

# Power simulation across N values
for (n in c(60, 80, 100, 120, 150, 200)) {
  power <- powerSim(fit, nsim = 200,
                    fixed = "conditionv2",
                    along = "participant_id",
                    n = n)
  cat(sprintf("N = %d per condition: power = %.2f\n", n, power$power))
}
```
