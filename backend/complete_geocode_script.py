#!/usr/bin/env python3
"""
完整的批量地理编码脚本 - 处理所有剩余的地址
"""

import requests
import time
import json

BASE_URL = "http://localhost:8000"

def get_geocode_status():
    """获取地理编码状态"""
    response = requests.get(f"{BASE_URL}/api/geocode/status")
    return response.json()

def batch_update_coordinates(limit=50):
    """批量更新坐标（总是从offset=0开始，因为已处理的会被跳过）"""
    response = requests.post(f"{BASE_URL}/api/geocode/batch-update", params={
        "limit": limit,
        "offset": 0  # 总是从0开始，系统会跳过已有坐标的地址
    })
    return response.json()

def main():
    """主函数 - 持续处理直到所有地址都有坐标"""
    print("🚀 开始完整的批量地理编码...")
    
    while True:
        # 获取当前状态
        status = get_geocode_status()
        remaining = status['without_coordinates']
        total = status['total_addresses']
        
        print(f"\n📊 当前状态:")
        print(f"   总地址: {total}")
        print(f"   有坐标: {status['with_coordinates']}")
        print(f"   剩余: {remaining}")
        print(f"   完成率: {status['completion_rate']:.2f}%")
        
        if remaining == 0:
            print("\n🎉 所有地址都已获取坐标！")
            break
        
        # 处理下一批
        batch_size = min(50, remaining)  # 不超过剩余数量
        print(f"\n🔄 处理接下来的 {batch_size} 个地址...")
        
        try:
            result = batch_update_coordinates(limit=batch_size)
            
            processed = result.get('processed', 0)
            successful = result.get('successful', 0) 
            failed = result.get('failed', 0)
            
            print(f"   ✅ 成功: {successful}")
            print(f"   ❌ 失败: {failed}")
            print(f"   ⚡ 处理: {processed}")
            
            # 如果没有处理任何地址，说明出现问题
            if processed == 0:
                print("   ⚠️ 没有处理任何地址，可能出现问题")
                break
            
            # 显示一些处理结果
            if result.get('details'):
                print("   📍 处理的地址:")
                for detail in result['details'][:3]:  # 只显示前3个
                    if detail['status'] == 'success':
                        print(f"      ✅ {detail['customer_name']}")
                    else:
                        print(f"      ❌ {detail['customer_name']}: {detail.get('error', '未知错误')}")
            
            # 避免API限制
            if remaining > batch_size:  # 如果还有更多要处理
                print("   ⏱️ 等待 2 秒...")
                time.sleep(2)
                
        except Exception as e:
            print(f"   ❌ 批处理出错: {e}")
            print("   ⏱️ 等待 5 秒后重试...")
            time.sleep(5)
    
    # 获取最终状态
    final_status = get_geocode_status()
    print(f"\n🏆 最终结果:")
    print(f"   📊 总地址数: {final_status['total_addresses']}")
    print(f"   ✅ 有坐标: {final_status['with_coordinates']}")
    print(f"   ❌ 无坐标: {final_status['without_coordinates']}")
    print(f"   🎯 完成率: {final_status['completion_rate']:.2f}%")
    
    if final_status['without_coordinates'] == 0:
        print(f"\n🎊 恭喜！所有 {final_status['total_addresses']} 个地址都已成功获取坐标！")
    else:
        print(f"\n📝 还有 {final_status['without_coordinates']} 个地址需要手动处理")

if __name__ == "__main__":
    main()
