# 问题集工具契约

`prepare_question_set` 输入：

```json
{
  "title": "品牌可见度基线问题",
  "questions": [
    {
      "id": "q-001",
      "text": "适合中国中型品牌的 GEO 服务有哪些？",
      "intent": "comparison",
      "persona": "品牌市场负责人"
    }
  ]
}
```

允许的 `intent`：`awareness`、`consideration`、`comparison`、`decision`、`validation`。

`commit_question_set` 只接受 prepare 返回且未过期的 `ticketId`。成功必须同时出现 `questionSetId` 和 `receiptId`。
