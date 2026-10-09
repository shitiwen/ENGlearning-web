import type { ExamTarget } from '../types'

export interface WrittenPrompt {
  pastPaperId?:string
  id:string
  kind:'writing'|'translation'
  title:string
  examTargets:ExamTarget[]
  instructions:string
  material?:string
  minWords?:number
  maxWords?:number
  estimatedMinutes:number
  reference:string
  tips:string[]
}

export const writtenPrompts:WrittenPrompt[] = [
  { id:'writing-cet4-study', kind:'writing', title:'四级写作｜给新生的学习建议', examTargets:['cet4','general'], minWords:120, maxWords:180, estimatedMinutes:30,
    instructions:'Write an essay giving first-year university students advice on building a sustainable study routine. Explain one common difficulty, suggest practical actions, and support your advice with a specific example. Write 120–180 words.',
    reference:'Starting university brings both freedom and responsibility. One common difficulty is that students postpone small tasks until several deadlines arrive together. A sustainable routine can reduce this pressure without filling every hour with work.\n\nFirst, students should choose a fixed period each day for their most demanding subject. During this period, messages can wait. Second, they should divide a large assignment into clear steps and record what remains unfinished. For example, a student preparing a laboratory report might organize the data on Monday, draft the explanation on Tuesday, and check the figures on Wednesday. This makes progress visible and leaves time to correct mistakes.\n\nA good routine also includes rest. A short walk or a conversation with friends can help students return with better attention. The goal is not to study constantly, but to study regularly and understand what has been learned.',
    tips:['先给出明确建议，再解释原因和例子。','段落围绕同一主题，避免连接词堆砌。','检查主谓一致、冠词和句子是否完整。'],
  },
  { id:'writing-cet4-library', kind:'writing', title:'四级写作｜改善校园学习空间', examTargets:['cet4','general'], minWords:120, maxWords:180, estimatedMinutes:30,
    instructions:'Write a letter to your university library suggesting an improvement to its study spaces. Describe the problem, explain your proposal, and state how it would benefit students. Write 120–180 words.',
    reference:'Dear Library Team,\n\nI am writing to suggest a clearer division between quiet study areas and group discussion spaces. The library is an important place for students, but these two activities sometimes take place in the same room. As a result, readers are distracted while project groups feel uncomfortable speaking.\n\nMy proposal is to reserve one floor for silent reading and provide a few rooms for discussion. Clear signs at the entrance would help students choose the right place. An online booking system could also make group rooms easier to share fairly.\n\nThese changes would benefit both individuals and teams. Students preparing for examinations could concentrate without interruption, and groups could exchange ideas without disturbing others. A short trial would allow the library to collect feedback before making a permanent arrangement.\n\nThank you for considering this suggestion.\n\nYours sincerely,\nA student',
    tips:['信件需要称呼、写作目的和结尾。','建议应具体、可执行，不只是抱怨。','保持礼貌，解释提议如何解决问题。'],
  },
  { id:'writing-cet6-ai', kind:'writing', title:'六级写作｜AI 与独立思考', examTargets:['cet6'], minWords:150, maxWords:200, estimatedMinutes:30,
    instructions:'Write an essay discussing how university students can benefit from AI tools while preserving independent thinking. Present your position, consider a possible concern, and illustrate your reasoning. Write 150–200 words.',
    reference:'AI tools can broaden access to explanations, examples, and feedback. However, their educational value depends on how students use them. In my view, AI should support the process of thinking rather than replace it.\n\nA useful approach begins with an independent attempt. Students can then ask an AI tool to identify an unclear step or compare two explanations. For instance, after solving a circuit problem, a learner might request a second method and examine why the results agree. This makes the tool a source of questions as well as answers.\n\nA reasonable concern is that fluent responses may encourage trust without verification. Students should therefore check important claims against course materials and explain the final conclusion in their own words. Teachers can also assess drafts and reasoning, rather than judging only a polished final answer.\n\nIndependent thinking does not require refusing assistance. It requires retaining responsibility for the questions asked, the evidence accepted, and the decisions made. Used with these habits, AI can strengthen learning instead of concealing gaps in understanding.',
    tips:['论点、论据和例子应有清楚关系。','承认合理担忧，再说明解决方式。','优先用准确表达，避免为了高级词而误用。'],
  },
  { id:'translation-cet4-campus', kind:'translation', title:'四级翻译｜校园图书馆', examTargets:['cet4','general'], estimatedMinutes:30,
    instructions:'将下面的中文段落译成英文。注意信息完整、时态一致和自然搭配。',
    material:'大学图书馆不仅是借书的地方，也是学生学习和交流的重要空间。近年来，许多图书馆增加了数字资源，让学生能够随时查阅学术资料。一些图书馆还提供小组讨论室和安静的阅读区，以满足不同的学习需要。合理利用这些服务，可以帮助学生提高学习效率，养成独立查找信息的习惯。',
    reference:'A university library is not only a place to borrow books, but also an important space for students to study and exchange ideas. In recent years, many libraries have expanded their digital resources, allowing students to consult academic materials at any time. Some libraries also provide group discussion rooms and quiet reading areas to meet different learning needs. Making good use of these services can help students study more efficiently and develop the habit of finding information independently.',
    tips:['不仅……也是……可以用 not only ... but also ...。','近年来通常与现在完成时搭配。','不要漏译“不同的学习需要”和“独立查找信息”。'],
  },
  { id:'translation-cet4-bikes', kind:'translation', title:'四级翻译｜城市自行车出行', examTargets:['cet4','general'], estimatedMinutes:30,
    instructions:'将下面的中文段落译成英文。注意保留因果关系，不必逐字对应。',
    material:'骑自行车是许多人日常出行的一种选择。它不仅有助于减少交通拥堵，还能让人们在出行的同时锻炼身体。为了让骑行更加安全，一些城市正在改善自行车道，并在路口设置更清晰的标志。只有道路设计和使用者的行为共同改善，骑行才能成为更方便、更可靠的交通方式。',
    reference:'Cycling is a daily transport option for many people. It not only helps reduce traffic congestion, but also allows people to exercise while travelling. To make cycling safer, some cities are improving bicycle lanes and installing clearer signs at intersections. Only when both road design and road users’ behaviour improve can cycling become a more convenient and reliable means of transport.',
    tips:['锻炼身体可以自然地译为 exercise。','注意“为了”和“只有……才能……”的逻辑。','检查名词单复数以及 transport 的不可数用法。'],
  },
  { id:'translation-cet6-repair', kind:'translation', title:'六级翻译｜维修与资源利用', examTargets:['cet6'], estimatedMinutes:30,
    instructions:'将下面的中文段落译成英文。准确表达比较、条件和限制。',
    material:'随着人们越来越重视资源的有效利用，维修旧产品的价值正在被重新认识。延长产品寿命可以减少对新材料的需求，但维修并不总是最环保的选择。例如，一台耗电量很大的旧冰箱，即使仍然能够使用，也可能带来较高的环境成本。因此，决定维修还是更换产品时，需要综合考虑制造、使用和维护等环节的影响，而不能只比较购买价格。',
    reference:'As people attach increasing importance to the efficient use of resources, the value of repairing old products is being reconsidered. Extending a product’s life can reduce demand for new materials, but repair is not always the most environmentally friendly option. For example, an old refrigerator that consumes a great deal of electricity may impose high environmental costs even if it still works. Therefore, when deciding whether to repair or replace a product, it is necessary to consider the combined effects of manufacturing, use, and maintenance rather than simply compare purchase prices.',
    tips:['保留“并不总是”这一限制，避免译成绝对否定。','whether to repair or replace 可表达决策。','环境成本不只是价格，注意两个概念的区别。'],
  },
]
