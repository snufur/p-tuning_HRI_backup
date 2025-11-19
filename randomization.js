// 实验条件随机化模块
// 负责为每个被试生成独特的实验条件

class ExperimentRandomizer {
    constructor(scenarioData) {
        this.scenarioData = scenarioData;
        
        // 使用从system_prompts.js导入的配置，而不是硬编码
        // MODEL_CONFIGS 应该总是存在，因为它是在 system_prompts.js 中定义的
        // 它包含了 model 和 systemPrompt，无需硬编码任何值
        if (typeof MODEL_CONFIGS === 'undefined') {
            throw new Error('错误：MODEL_CONFIGS 未正确加载。请确保 system_prompts.js 在 randomization.js 之前加载');
        }
        this.modelConfigs = MODEL_CONFIGS;
        
        // Block type编码：1=very impolite, 2=little impolite, 3=neutral, 4=little polite, 5=very polite
        this.blockTypes = [1, 2, 3, 4, 5];
        this.blockTypeNames = {
            1: 'very impolite',
            2: 'little impolite', 
            3: 'neutral',
            4: 'little polite',
            5: 'very polite'
        };
        
        // Model type编码：1=impolite, 2=neutral, 3=polite
        this.modelTypeNames = {
            1: 'impolite',
            2: 'neutral', 
            3: 'polite'
        };
    }

    // 步骤1：将100个item随机分配到5个block_type中
    randomizeItemsToBlocks() {
        // 创建item编号数组
        const items = Array.from({length: 100}, (_, i) => i + 1);
        
        // 随机打乱item顺序
        this.shuffleArray(items);
        
        // 将100个item平均分配到5个block_type（每个block_type 20个item）
        const itemBlocks = {};
        this.blockTypes.forEach((blockType, index) => {
            const startIndex = index * 20;
            const endIndex = startIndex + 20;
            itemBlocks[blockType] = items.slice(startIndex, endIndex);
        });
        
        console.log('步骤1完成：100个item随机分配到5个block_type');
        return itemBlocks;
    }

    // 步骤2：根据block_type为每个item分配model_type、prompt和model
    assignModelTypesToItems(itemBlocks) {
        const itemConfigs = {}; // 存储每个item的配置
        
        Object.keys(itemBlocks).forEach(blockTypeStr => {
            const blockType = parseInt(blockTypeStr);
            const items = itemBlocks[blockType];
            
            // 根据block_type确定model_type分配
            const modelTypeAllocation = this.getModelTypeAllocation(blockType);
            
            // 应用伪随机规则：确保不超过3个连续的相同model_type
            const pseudoRandomAllocation = this.applyPseudoRandomRule(modelTypeAllocation);
            
            // 为每个item分配model_type和配置
            items.forEach((itemNum, index) => {
                const modelType = pseudoRandomAllocation[index];
                const modelTypeName = this.modelTypeNames[modelType];
                const config = this.modelConfigs[modelTypeName];
                
                itemConfigs[itemNum] = {
                    block_type: blockType,
                    model_type: modelType,
                    model: config.model,
                    system_prompt: config.systemPrompt
                };
            });
        });
        
        console.log('步骤2完成：为每个item分配model_type和对应配置');
        return itemConfigs;
    }

    // 步骤3：伪随机化同一block_type内部的item顺序
    randomizeItemOrderWithinBlocks(itemBlocks) {
        const randomizedItemBlocks = {};
        
        Object.keys(itemBlocks).forEach(blockTypeStr => {
            const blockType = parseInt(blockTypeStr);
            const items = [...itemBlocks[blockType]]; // 复制数组
            
            // 打乱该block_type内的item顺序
            this.shuffleArray(items);
            
            randomizedItemBlocks[blockType] = items;
        });
        
        console.log('步骤3完成：伪随机化每个block_type内的item顺序');
        return randomizedItemBlocks;
    }

    // 步骤4：生成最终的trials数据
    generateTrialsWithBlockOrder(itemBlocks, itemConfigs, blockOrder) {
        const allTrials = [];
        let globalTrialNum = 1; // 全局trial编号
        
        // 按照blockOrder的顺序生成trials
        blockOrder.forEach((blockType, blockOrderIndex) => {
            const items = itemBlocks[blockType];
            
            items.forEach((itemNum, trialOrderIndex) => {
                const config = itemConfigs[itemNum];
                const scenario = this.scenarioData.find(s => s.item === itemNum);
                
                if (scenario && config) {
                    allTrials.push({
                        trial: globalTrialNum,                    // 全局trial编号
                        block_type: config.block_type,            // block类型（1-5）
                        block_order: blockOrderIndex + 1,         // 该block的呈现顺序
                        trial_order: trialOrderIndex + 1,         // 该trial在block内的顺序
                        item: itemNum,                            // item编号
                        scenario: scenario.scenario,              // 情境文本
                        model_type: config.model_type,            // model类型（1-3）
                        model: config.model,                      // 模型名称
                        system_prompt: config.system_prompt       // 系统提示词
                    });
                    globalTrialNum++;
                }
            });
        });
        
        console.log('步骤4完成：生成最终trials数据，共', allTrials.length, '个trials');
        return allTrials;
    }

    // 根据block类型获取model type分配
    getModelTypeAllocation(blockType) {
        switch (blockType) {
            case 5: // very polite
                return Array(20).fill(3); // 全部polite
            case 4: // little polite
                return [...Array(10).fill(3), ...Array(10).fill(2)]; // 10个polite + 10个neutral
            case 3: // neutral
                return Array(20).fill(2); // 全部neutral
            case 2: // little impolite
                return [...Array(10).fill(2), ...Array(10).fill(1)]; // 10个neutral + 10个impolite
            case 1: // very impolite
                return Array(20).fill(1); // 全部impolite
            default:
                return Array(20).fill(2); // 默认neutral
        }
    }

    // 应用伪随机规则：确保不超过3个连续的相同model type
    applyPseudoRandomRule(modelTypeAllocation) {
        const result = [...modelTypeAllocation];
        const maxConsecutive = 3;
        
        // 先随机打乱
        this.shuffleArray(result);
        
        // 检查并修复连续相同的情况
        for (let i = 0; i < result.length - maxConsecutive; i++) {
            // 检查从位置i开始的连续相同元素
            let consecutiveCount = 1;
            const currentType = result[i];
            
            // 计算连续相同元素的数量
            for (let j = i + 1; j < result.length; j++) {
                if (result[j] === currentType) {
                    consecutiveCount++;
                } else {
                    break;
                }
            }
            
            // 如果超过最大连续数，需要重新排列
            if (consecutiveCount > maxConsecutive) {
                // 找到可以交换的位置
                const swapIndex = this.findSwapIndex(result, i + maxConsecutive, currentType);
                if (swapIndex !== -1) {
                    // 交换元素
                    [result[i + maxConsecutive], result[swapIndex]] = [result[swapIndex], result[i + maxConsecutive]];
                }
            }
        }
        
        return result;
    }

    // 找到可以交换的位置（避免连续相同）
    findSwapIndex(array, startIndex, avoidType) {
        for (let i = startIndex; i < array.length; i++) {
            if (array[i] !== avoidType) {
                return i;
            }
        }
        return -1; // 没有找到合适的交换位置
    }


    // 主函数：生成完整的随机化实验条件
    generateRandomizedConditions() {
        console.log('=== 开始生成随机化实验条件 ===\n');
        
        // 步骤1：将100个scenario随机分配到5个block_type中
        const itemBlocks = this.randomizeItemsToBlocks();
        
        // 步骤2：根据block_type为每个item分配model_type、prompt和model
        const itemConfigs = this.assignModelTypesToItems(itemBlocks);
        
        // 步骤3：伪随机化同一block_type内部的item顺序
        const randomizedItemBlocks = this.randomizeItemOrderWithinBlocks(itemBlocks);
        
        // 步骤4：随机化block_type的呈现顺序
        const blockOrder = [...this.blockTypes];
        this.shuffleArray(blockOrder);
        console.log('步骤4完成：block_type呈现顺序 =', blockOrder);
        
        // 步骤5：生成最终的trials数据
        const allTrials = this.generateTrialsWithBlockOrder(
            randomizedItemBlocks, 
            itemConfigs, 
            blockOrder
        );
        
        // 记录随机化信息（保存打乱后的itemBlocks以便准确恢复）
        const randomizationInfo = {
            timestamp: new Date().toISOString(),
            itemBlocks: randomizedItemBlocks,    // 打乱后的item分配（用于恢复）
            itemConfigs: itemConfigs,            // 每个item的配置（用于恢复）
            blockOrder: blockOrder,              // block呈现顺序
            totalTrials: allTrials.length
        };
        
        console.log('\n=== 随机化完成！===');
        console.log('总trials数：', allTrials.length);
        console.log('Block呈现顺序：', blockOrder.map(bt => this.blockTypeNames[bt]));
        
        return {
            conditionData: allTrials,
            randomizationInfo: randomizationInfo
        };
    }

    // 工具函数：数组随机打乱
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 验证随机化结果
    validateRandomization(result) {
        const { conditionData, randomizationInfo } = result;
        
        console.log('\n=== 验证随机化结果 ===');
        
        // 检查每个block_type是否有20个trials
        const blockTypeCounts = {};
        conditionData.forEach(trial => {
            blockTypeCounts[trial.block_type] = (blockTypeCounts[trial.block_type] || 0) + 1;
        });
        
        console.log('各block_type的trial数量：', blockTypeCounts);
        
        // 检查model_type分布
        const modelTypeCounts = {};
        conditionData.forEach(trial => {
            const key = `${trial.block_type}_${trial.model_type}`;
            modelTypeCounts[key] = (modelTypeCounts[key] || 0) + 1;
        });
        
        console.log('各block_type的model_type分布：', modelTypeCounts);
        
        // 验证每个block_type的model_type配置是否正确
        const expectedDistribution = {
            1: { 1: 20 },              // very impolite: 全部impolite
            2: { 1: 10, 2: 10 },       // little impolite: 10个impolite + 10个neutral
            3: { 2: 20 },              // neutral: 全部neutral
            4: { 2: 10, 3: 10 },       // little polite: 10个neutral + 10个polite
            5: { 3: 20 }               // very polite: 全部polite
        };
        
        let distributionCorrect = true;
        for (let blockType = 1; blockType <= 5; blockType++) {
            const expected = expectedDistribution[blockType];
            for (let modelType in expected) {
                const key = `${blockType}_${modelType}`;
                const actual = modelTypeCounts[key] || 0;
                const expectedCount = expected[modelType];
                if (actual !== expectedCount) {
                    console.warn(`⚠️ Block ${blockType}, Model ${modelType}: 预期${expectedCount}个，实际${actual}个`);
                    distributionCorrect = false;
                }
            }
        }
        
        const isValid = Object.values(blockTypeCounts).every(count => count === 20) && distributionCorrect;
        
        console.log(isValid ? '✅ 验证通过' : '❌ 验证失败');
        
        return {
            isValid: isValid,
            blockTypeCounts: blockTypeCounts,
            modelTypeCounts: modelTypeCounts
        };
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExperimentRandomizer;
}
