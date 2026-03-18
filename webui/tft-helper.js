const comps = [
  {
    name: "前排枪手过渡",
    coreUnits: ["盖伦", "薇恩", "奥恩", "金克丝", "蔚", "洛"],
    carryUnits: ["金克丝", "薇恩"],
    preferredItems: ["无尽", "最后的轻语", "巨人杀手", "正义之手"],
    levelWindow: [6, 8],
    shopBias: ["盖伦", "薇恩", "金克丝", "蔚"],
    summary: "适合中期靠两星前排和物理后排稳血，4-1 前后有一定 D 牌价值。"
  },
  {
    name: "法系运营过渡",
    coreUnits: ["安妮", "辛德拉", "拉克丝", "妮蔻", "璐璐", "俄洛伊"],
    carryUnits: ["拉克丝", "辛德拉"],
    preferredItems: ["蓝霸符", "珠光护手", "灭世者的死亡之帽", "纳什之牙"],
    levelWindow: [7, 9],
    shopBias: ["安妮", "辛德拉", "拉克丝"],
    summary: "适合经济较好、装备偏法强时转型，优先保连胜和上人口。"
  },
  {
    name: "斗士射手稳血",
    coreUnits: ["瑟提", "厄斐琉斯", "慎", "艾希", "猪妹", "烬"],
    carryUnits: ["厄斐琉斯", "烬"],
    preferredItems: ["鬼索的狂暴之刃", "无尽", "巨人杀手", "水银"],
    levelWindow: [7, 9],
    shopBias: ["厄斐琉斯", "艾希", "慎", "瑟提"],
    summary: "适合物理装较顺但来牌分散时，靠高质量单卡稳定过渡。"
  }
];

const itemMap = [
  { parts: ["大剑", "拳套"], result: "无尽", tags: ["物理输出"] },
  { parts: ["反曲弓", "拳套"], result: "最后的轻语", tags: ["破甲", "物理输出"] },
  { parts: ["大剑", "反曲弓"], result: "巨人杀手", tags: ["通用输出"] },
  { parts: ["眼泪", "眼泪"], result: "蓝霸符", tags: ["法系启动"] },
  { parts: ["大棒", "拳套"], result: "珠光护手", tags: ["法爆"] },
  { parts: ["大棒", "大棒"], result: "灭世者的死亡之帽", tags: ["法强"] },
  { parts: ["反曲弓", "大棒"], result: "纳什之牙", tags: ["攻速法系"] },
  { parts: ["拳套", "眼泪"], result: "正义之手", tags: ["混合输出"] },
  { parts: ["反曲弓", "反曲弓"], result: "鬼索的狂暴之刃", tags: ["持续输出"] },
  { parts: ["拳套", "斗篷"], result: "水银", tags: ["防控制"] }
];

function parseTokens(value) {
  return value
    .split(/[\s,，]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function countMatches(source, target) {
  return target.filter((item) => source.includes(item)).length;
}

function pickComp(level, boardUnits, shopUnits, items) {
  const scored = comps
    .map((comp) => {
      const boardScore = countMatches(boardUnits, comp.coreUnits) * 3;
      const shopScore = countMatches(shopUnits, comp.shopBias) * 2;
      const itemScore = countMatches(items, comp.preferredItems) * 2;
      const levelScore = level >= comp.levelWindow[0] && level <= comp.levelWindow[1] ? 2 : 0;
      return { comp, score: boardScore + shopScore + itemScore + levelScore };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.comp ?? comps[0];
}

function resolveItems(components) {
  const normalized = [...components];
  const crafted = [];

  for (const recipe of itemMap) {
    const left = normalized.indexOf(recipe.parts[0]);
    const right = normalized.indexOf(recipe.parts[1]);

    if (left !== -1 && right !== -1 && left !== right) {
      crafted.push(recipe);
      const next = normalized.filter((_, index) => index !== left && index !== right);
      normalized.length = 0;
      normalized.push(...next);
    }
  }

  return crafted;
}

function economyAdvice({ level, gold, hp, stage }) {
  if (hp <= 35) {
    return "当前血量偏低。建议本回合优先稳血，允许破 50 利息，必要时在当前等级 D 到主力两星。";
  }

  if (stage === "4-1" || stage === "4-5") {
    if (gold >= 30 && level < 8) {
      return "当前处于中后期关键节点。优先考虑上 8 提质量，再决定是否大 D。";
    }

    if (gold < 20) {
      return "金币偏少。以最小代价补强前排和主 C，避免无计划空 D。";
    }
  }

  if (gold >= 50) {
    return "经济健康。优先吃满利息，根据来牌决定慢 D 或上人口。";
  }

  if (level <= 6 && gold >= 30) {
    return "前中期节奏正常。优先保经济，除非连败血量过低，否则不建议重 D。";
  }

  return "当前局势中性。按阵容强度决定是否小 D 两下找关键对子，不建议盲目梭哈。";
}

function shopAdvice(shopUnits, boardUnits, comp) {
  const keep = [];
  const skip = [];

  shopUnits.forEach((unit) => {
    if (comp.coreUnits.includes(unit) || boardUnits.includes(unit)) {
      keep.push(unit);
    } else {
      skip.push(unit);
    }
  });

  return {
    keep: keep.length ? keep : ["当前商店没有明显同体系强牌，优先保经济"],
    skip: skip.length ? skip : ["当前商店基本都能留"]
  };
}

function renderCard(container, title, body) {
  const card = document.createElement("div");
  card.className = "card";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const p = document.createElement("p");
  p.textContent = body;
  card.append(strong, p);
  container.append(card);
}

function renderAnalysis() {
  const level = Number(document.querySelector("#level").value);
  const gold = Number(document.querySelector("#gold").value);
  const hp = Number(document.querySelector("#hp").value);
  const stage = document.querySelector("#stage").value;
  const components = parseTokens(document.querySelector("#components").value);
  const shopUnits = parseTokens(document.querySelector("#shop").value);
  const boardUnits = parseTokens(document.querySelector("#board").value);

  const craftedItems = resolveItems(components);
  const comp = pickComp(
    level,
    boardUnits,
    shopUnits,
    craftedItems.map((item) => item.result)
  );
  const shop = shopAdvice(shopUnits, boardUnits, comp);

  const compResult = document.querySelector("#compResult");
  const shopResult = document.querySelector("#shopResult");
  const itemResult = document.querySelector("#itemResult");
  const economyResult = document.querySelector("#economyResult");

  [compResult, shopResult, itemResult, economyResult].forEach((node) => {
    node.innerHTML = "";
  });

  renderCard(
    compResult,
    comp.name,
    `${comp.summary} 主 C 倾向：${comp.carryUnits.join("、")}。核心牌：${comp.coreUnits.join("、")}`
  );

  renderCard(shopResult, "优先买", shop.keep.join("、"));
  renderCard(shopResult, "可以放过", shop.skip.join("、"));

  if (craftedItems.length) {
    craftedItems.forEach((recipe) => {
      renderCard(
        itemResult,
        recipe.result,
        `由 ${recipe.parts.join(" + ")} 合成。用途：${recipe.tags.join("、")}`
      );
    });
  } else {
    renderCard(
      itemResult,
      "当前散件不足以成装",
      "优先保留能做主 C 核心装的散件，不要为了凑临时战力乱合。"
    );
  }

  renderCard(economyResult, "节奏建议", economyAdvice({ level, gold, hp, stage }));
}

document.querySelector("#analyze").addEventListener("click", renderAnalysis);
renderAnalysis();
