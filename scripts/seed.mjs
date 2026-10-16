import fs from "node:fs";
const sql = (s) => `'${String(s).replaceAll("'", "''")}'`;
const t = Date.parse("2026-10-12T04:00:00Z");
const scenes = [
  {
    id: "demo-birthday",
    title: "一起过生日，也一起吃顿饭",
    organizer: "乡村小学的老师们（虚构）",
    scene: "birthday",
    story:
      "有的生日，是一个人吹蜡烛；有的生日，是一整间教室一起许愿。老师们想为这个月过生日的孩子们准备一顿共同的午餐，让每个愿望都被认真听见。\n\n这是一个虚构的乡村小学集体生日场景。每个月，老师重新确认本期人数、餐食与送达安排，才发布下一份需要。",
    quantity: 30,
    meal: "汉堡、薯条与饮品套餐",
    spec: "演示餐单：指定汉堡 1 份、薯条 1 份、饮品 1 杯；真实发布须按可配送菜单核实。",
    place: "乡村小学 · 共享餐桌（虚构）",
    address: "演示地址 · 不对应真实学校或收货地点",
    price: 90000,
    recurring: 30,
    name: "星期三的朋友",
    feedback:
      "孩子们把这顿午餐叫作“生日大餐”。我们围坐在一起，唱歌、许愿，也记得谢谢那位没有到场的朋友。（模拟反馈）",
  },
  {
    id: "demo-training",
    title: "为学习守护他人的人，加一餐",
    organizer: "社区急救学习小组（虚构）",
    scene: "training",
    story:
      "从按压节奏到包扎练习，一上午的训练，需要专注，也需要一点体力。给学习急救的伙伴们准备好午餐，让他们在休息之后继续练习，带着更扎实的本领回到日常。\n\n这是虚构的急救培训场景，不代表与红十字会或任何真实培训机构的合作。",
    quantity: 24,
    meal: "鸡肉汉堡与饮品套餐",
    spec: "演示餐单：指定鸡肉汉堡 1 份、配餐 1 份、饮品 1 杯；实际份量与商品由发起方确认。",
    place: "社区学习空间（虚构）",
    address: "演示地址 · 不对应真实培训机构或收货地点",
    price: 72000,
    recurring: null,
    name: "一位路过的邻居",
    feedback:
      "午餐准时摆上桌，大家边吃边交流练习心得。下午又多学会了一种帮助别人的方法。谢谢这份支持。（模拟反馈）",
  },
  {
    id: "demo-basketball",
    title: "终场哨响后，我们一起开饭",
    organizer: "校园篮球社（虚构）",
    scene: "basketball",
    story:
      "最后一球落地，输赢有了结果，友谊还在继续。队员、裁判和志愿者忙完决赛，终于可以坐在一起，把赛场上的故事再讲一遍。\n\n这是一份虚构的大学篮球决赛餐食需求。指定的整单餐食由一位赞助人支持，队员收餐后留下赛后反馈与感谢。",
    quantity: 40,
    meal: "双层汉堡与饮品套餐",
    spec: "演示餐单：指定双层汉堡 1 份、薯条 1 份、饮品 1 杯；真实下单不允许赞助人自行替换。",
    place: "大学体育馆旁 · 休息区（虚构）",
    address: "演示地址 · 不对应真实大学或收货地点",
    price: 128000,
    recurring: null,
    name: "校友 7 号",
    feedback:
      "比分定格了，大家还没聊够。这顿饭让两队和志愿者坐到同一张桌前。谢谢校友 7 号，让今天有了一个温暖的结尾。（模拟反馈）",
  },
];
let out =
  "INSERT OR IGNORE INTO users(id,created_at) VALUES('demo-owner',1),('demo-sponsor',1);\n";
for (const s of scenes) {
  const data = {
    title: s.title,
    story: s.story,
    organizer: s.organizer,
    scene: s.scene,
    meals: [{ name: s.meal, quantity: s.quantity, specification: s.spec }],
    quantity: s.quantity,
    location: { name: s.place, address: s.address, lat: 0, lng: 0 },
    mealAt: t,
    acceptBy: t - 7200000,
    referenceCents: s.price,
    referenceAt: t - 86400000,
    recurringDays: s.recurring,
    consent: true,
    deliveryCheckedAt: t - 86400000,
  };
  out += `INSERT OR IGNORE INTO needs(id,owner_id,status,demo,data,private_data,created_at,updated_at,accept_by,recurring_days,received_at,feedback,completed_at) VALUES(${sql(s.id)},'demo-owner','completed',1,${sql(JSON.stringify(data))},'',${t - 86400000},${t + 3600000},${t - 7200000},${s.recurring ?? "NULL"},${t},${sql(s.feedback)},${t + 3600000});\n`;
  out += `INSERT OR IGNORE INTO attempts(id,need_id,sponsor_id,need_version,state,display_name,created_at,updated_at,lock_until,last_sync) VALUES(${sql(s.id + "-attempt")},${sql(s.id)},'demo-sponsor',1,'delivered',${sql(s.name)},${t - 86400000},${t},${t - 86400000},${t});\n`;
}
fs.writeFileSync("migrations/0002_demo.sql", out);
console.log("Three explicitly fictional examples generated.");
