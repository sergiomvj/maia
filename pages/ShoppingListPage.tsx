
import React, { useState, useEffect } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import Icon from '../components/Icon';
import { ICONS } from '../constants';
import { ShoppingListItem } from '../types';
import { playToggleSound, playClearSound } from '../utils/audioEffects';

type GeminiLiveHook = ReturnType<typeof useGeminiLive>;

interface ShoppingListPageProps {
  geminiLive: GeminiLiveHook;
}

const ShoppingItem: React.FC<{
  item: ShoppingListItem;
  onToggle: (id: string) => void;
  onRemove: (name: string) => void;
}> = ({ item, onToggle, onRemove }) => {
  return (
    <div className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
      <button onClick={() => onToggle(item.id)} className="mr-4" aria-label={`Mark ${item.item} as ${item.is_collected ? 'not collected' : 'collected'}`}>
        <Icon
          path={item.is_collected ? ICONS.checkboxChecked : ICONS.checkboxUnchecked}
          className={`w-6 h-6 ${item.is_collected ? 'text-green-500 dark:text-green-400' : 'text-gray-400'}`}
        />
      </button>
      <div className="flex-1">
        <p className={`text-lg ${item.is_collected ? 'line-through text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
          {item.item}
        </p>
        {item.quantity > 1 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
                Quantity: {item.quantity}
            </span>
        )}
      </div>
      <button onClick={() => onRemove(item.item)} className="text-gray-500 hover:text-red-500 dark:hover:text-red-400" aria-label={`Remove ${item.item}`}>
        <Icon path={ICONS.delete} className="w-5 h-5" />
      </button>
    </div>
  );
};

const ShoppingListPage: React.FC<ShoppingListPageProps> = ({ geminiLive }) => {
  const { shoppingList, addShoppingListItem, removeShoppingListItem, toggleShoppingListItem } = geminiLive;
  const [newItem, setNewItem] = useState('');

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.trim()) {
      addShoppingListItem(newItem.trim());
      setNewItem('');
    }
  };

  const handleToggle = (id: string) => {
    toggleShoppingListItem(id);
    playToggleSound();
  };

  const handleRemove = (name: string) => {
    removeShoppingListItem(name);
    playClearSound();
  };
  
  const activeItems = shoppingList.filter(i => !i.is_collected);
  const collectedItems = shoppingList.filter(i => i.is_collected);


  return (
    <div className="p-8 h-full overflow-y-auto">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Shopping List</h2>

      <form onSubmit={handleAddItem} className="flex gap-4 mb-8">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add a new item (e.g., '2 cartons of milk')"
          className="flex-grow bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
          Add Item
        </button>
      </form>

      {shoppingList.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-4">To Get</h3>
             <div className="space-y-3">
                {activeItems.map(item => (
                    <ShoppingItem key={item.id} item={item} onToggle={handleToggle} onRemove={handleRemove} />
                ))}
                 {activeItems.length === 0 && <p className="text-gray-500">All items collected!</p>}
            </div>
          </div>

           {collectedItems.length > 0 && <details className="pt-6">
                <summary className="text-lg font-semibold cursor-pointer text-gray-600 dark:text-gray-400">Collected ({collectedItems.length})</summary>
                <div className="space-y-3 mt-4">
                    {collectedItems.map(item => (
                        <ShoppingItem key={item.id} item={item} onToggle={handleToggle} onRemove={handleRemove} />
                    ))}
                </div>
            </details>}
        </div>
      ) : (
         <div className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Icon path={ICONS.shoppingList} className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Your shopping list is empty</h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Use the input above or just say "Hey MarIA, add apples to my shopping list".</p>
        </div>
      )}
    </div>
  );
};

export default ShoppingListPage;
