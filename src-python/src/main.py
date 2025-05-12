
from utils import *
import os
from os import system
import pandas as pd
from numpy import nan

S_cols = ["规格.1"]
path_s = "月报.xlsx"

T_cols = ["产品规格型号", "数量"]
path_t = "出库单.xls"

H_cols = ["产品名称", "规格型号", "数量", "批号"]
H_special_ids_dict = {
    "24*185": "螺旋道钉S1",
    "24*220": "螺旋道钉S2"
}
path_h = "入库单.xlsx"

Z_cols = ["产品名称", "规格型号", "在线盘点数量<主计量>"]
Z_special_ids_dict = {
    "24*185": "螺旋道钉S1",
    "24*220": "螺旋道钉S2"
}
path_z = "在制品.XLSX"

path_w = "弹条生产记录.xlsx"
W_cols = [
    "调试", "低温", "压坏", "黑料", "过烧",
    "淬火报废", "回火报废", "成品报废", "批号"
]
w_args = {
    "eng_waste": ["调试", "低温", "压坏", "黑料"],
    "raw_waste": ["过烧"],
    "exp_waste": ["淬火报废", "回火报废", "成品报废"]
}


def run():
    print("正在运行中...")

    t_ids, t_dict = get_dict_t(df_t_in)
    h_ids, h_dict = get_dict_h(df_h_in, H_special_ids_dict)
    z_ids, z_dict = get_dict_z(df_z_in, Z_special_ids_dict)
    w_ids_and_batch_num = get_dict_id_and_batch_num(s_ids, df_h_in)
    dict_w_in = waste_read(path_w, W_cols)
    waste_dict = get_dict_w(dict_w_in, w_ids_and_batch_num, w_args)

    new_df = pd.DataFrame(columns=[
        "规格", "投料", "合格品", "在制品", "工废", "料废", "实验破坏"
    ])

    i = 0
    for model in s_ids:
        new_list = [model]

        new_list.append(t_dict.get(model, nan))
        new_list.append(h_dict.get(model, nan))
        new_list.append(z_dict.get(model, nan))

        new_list.append(waste_dict[model]["eng_waste"])
        new_list.append(waste_dict[model]["raw_waste"])
        new_list.append(waste_dict[model]["exp_waste"])

        new_df.loc[i] = new_list
        i += 1

    try:
        print("处理完成，正在导出文件")
        new_df.to_excel("汇总文件.xlsx", index=False)
        print("文件导出为：汇总文件.xlsx")
    except IOError:
        print("导出失败: 文件使用中。尝试关闭并重新运行程序")

    os.system("pause")


if __name__ == "__main__":
    df_s_in, df_t_in, df_h_in, df_z_in = file_read_all(
        path_s, path_t, path_h, path_z,
        S_cols, T_cols, H_cols, Z_cols
    )
    s_ids = get_ids(df_s_in)
    run()
