import {test} from 'node:test';import assert from 'node:assert/strict';import {CATEGORY_IDS} from '../src/purchase-categories.mjs';import {decidePurchase,PURCHASE_RULES} from '../src/purchase-rules.mjs';import {validSettings,DEFAULT_SETTINGS} from '../src/family.mjs';
test('fresh produce is permitted when selected but never bypasses cap, balance or certainty',()=>{
 const apple={productName:'Fresh apple',category:'fruits_vegetables',uncertain:false,prohibited:false};
 assert.equal(decidePurchase(apple,'100','10000000'),null);
 assert.equal(decidePurchase(apple,'100','10000000',{...PURCHASE_RULES,allowedCategories:['meals']}),'CATEGORY_DISALLOWED');
 assert.equal(decidePurchase(apple,'485','10000000'),'CAP_EXCEEDED');
 assert.equal(decidePurchase(apple,'100','0'),'INSUFFICIENT_FUNDS');
 assert.equal(decidePurchase({...apple,uncertain:true},'100','10000000'),'AI_UNCERTAIN');
 assert.equal(decidePurchase({...apple,category:'snacks'},'100','10000000'),'CATEGORY_DISALLOWED');
});
test('new categories selectable without accepting invented categories or removing legacy IDs',()=>{
 for(const id of CATEGORY_IDS)assert.equal(validSettings({...DEFAULT_SETTINGS,needsCategories:[id]}),true);
 assert.equal(new Set(CATEGORY_IDS).size,CATEGORY_IDS.length);assert.equal(validSettings({...DEFAULT_SETTINGS,needsCategories:['invented']}),false);
 for(const id of ['meals','snacks','drinks','school_supplies','books','toys_collectibles'])assert.ok(CATEGORY_IDS.includes(id));
});
